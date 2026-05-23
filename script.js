/* ============================================================
   Global Safety Wear (Pty) Ltd — script.js
   Cart, PayFast Integration, Navigation
   ============================================================ */

const PAYFAST_MERCHANT_ID  = '18195722';
const PAYFAST_MERCHANT_KEY = '1ixywavgtvoql';
const PAYFAST_URL          = 'https://www.payfast.co.za/eng/process';
const RETURN_URL  = 'index.html';
const CANCEL_URL  = 'payment.html';

let cart = [];
try { cart = JSON.parse(localStorage.getItem('gsw_cart') || '[]'); } catch(e) { cart = []; }

let selectedDelivery = { label: 'Free Collection', fee: 0, key: 'collection' };
try {
  const saved = localStorage.getItem('gsw_delivery');
  if (saved) selectedDelivery = JSON.parse(saved);
} catch(e) {}

function saveCart() {
  localStorage.setItem('gsw_cart', JSON.stringify(cart));
  updateCartUI();
  updateNavCartCount();
}

function addToCart(id, name, price, size, qty, icon) {
  if (!qty || qty < 1) qty = 1;
  const existing = cart.find(i => i.id === id && i.size === size);
  if (existing) {
    existing.qty += parseInt(qty);
  } else {
    cart.push({ id, name, price: parseFloat(price), size, qty: parseInt(qty), icon: icon || '🧤' });
  }
  saveCart();
  showToast('✓  ' + name + ' (Size ' + size + ' × ' + qty + ') added to cart');
}

function removeFromCart(id, size) {
  cart = cart.filter(i => !(i.id === id && i.size === size));
  saveCart();
}

function cartSubtotal() {
  return cart.reduce(function(s, i) { return s + i.price * i.qty; }, 0);
}
function cartTotal() {
  return cartSubtotal() + (selectedDelivery.fee || 0);
}

function updateNavCartCount() {
  var total = cart.reduce(function(s, i) { return s + i.qty; }, 0);
  document.querySelectorAll('.cart-count').forEach(function(el) {
    el.textContent = total;
    el.style.display = total > 0 ? 'flex' : 'none';
  });
}

function updateCartUI() {
  var body  = document.getElementById('cart-body');
  var badge = document.getElementById('cart-count-badge');
  if (!body) return;

  var totalQty = cart.reduce(function(s, i) { return s + i.qty; }, 0);
  if (badge) badge.textContent = totalQty + ' item' + (totalQty !== 1 ? 's' : '');

  if (cart.length === 0) {
    body.innerHTML = '<div class="cart-empty"><span class="ico">🛒</span><p>Your cart is empty.</p><p>Add products to get started.</p></div>';
  } else {
    body.innerHTML = cart.map(function(item) {
      return '<div class="cart-item">' +
        '<div class="cart-item-icon">' + item.icon + '</div>' +
        '<div class="cart-item-info">' +
          '<h4>' + item.name + '</h4>' +
          '<span>Size: ' + item.size + ' &bull; Qty: ' + item.qty + '</span>' +
          '<span class="item-price">R' + (item.price * item.qty).toFixed(2) + '</span>' +
        '</div>' +
        '<button class="cart-item-remove" onclick="removeFromCart(\'' + item.id + '\',\'' + item.size + '\')" title="Remove">&times;</button>' +
      '</div>';
    }).join('');
  }
  updateTotals();
}

function updateTotals() {
  var sub   = cartSubtotal();
  var fee   = selectedDelivery.fee || 0;
  var grand = cartTotal();
  var feeStr = fee === 0 ? 'Free' : 'R' + fee.toFixed(2);

  function set(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; }
  set('cart-subtotal', 'R' + sub.toFixed(2));
  set('cart-delivery', feeStr);
  set('cart-total',    'R' + grand.toFixed(2));

  renderPaymentSummary();
}

function selectDelivery(key, label, fee) {
  selectedDelivery = { key: key, label: label, fee: parseFloat(fee) };
  localStorage.setItem('gsw_delivery', JSON.stringify(selectedDelivery));
  updateTotals();
}

function renderPaymentSummary() {
  var container       = document.getElementById('payment-items');
  var summaryDelivery = document.getElementById('summary-delivery');
  var summarySubtotal = document.getElementById('summary-subtotal');
  var summaryTotal    = document.getElementById('summary-total');
  if (!container) return;

  var sub   = cartSubtotal();
  var fee   = selectedDelivery.fee || 0;
  var grand = cartTotal();

  if (cart.length === 0) {
    container.innerHTML = '<div class="empty-summary"><span class="ico">🛒</span><p>No items in cart.<br><a href="products.html" style="color:var(--blue-mid)">Browse products</a></p></div>';
  } else {
    container.innerHTML = cart.map(function(item) {
      return '<div class="summary-item">' +
        '<div class="summary-item-name">' +
          '<strong>' + item.name + '</strong>' +
          '<small>Size: ' + item.size + ' &bull; Qty: ' + item.qty + '</small>' +
        '</div>' +
        '<div class="summary-item-price">R' + (item.price * item.qty).toFixed(2) + '</div>' +
      '</div>';
    }).join('');
  }

  if (summarySubtotal) summarySubtotal.textContent = 'R' + sub.toFixed(2);
  if (summaryDelivery) summaryDelivery.textContent = fee === 0 ? 'Free' : 'R' + fee.toFixed(2);
  if (summaryTotal)    summaryTotal.textContent    = 'R' + grand.toFixed(2);

  /* Sync amount into all PayFast hidden fields */
  var itemName = cart.length > 0
    ? cart.map(function(i) { return i.qty + 'x ' + i.name + ' (' + i.size + ')'; }).join(', ').substring(0, 255)
    : 'Global Safety Wear Order';

  document.querySelectorAll('.pf-amount').forEach(function(el)    { el.value = grand.toFixed(2); });
  document.querySelectorAll('.pf-item-name').forEach(function(el) { el.value = itemName; });

  /* web3forms hidden fields */
  var se = document.getElementById('order-summary-email');
  var te = document.getElementById('order-total-email');
  var de = document.getElementById('delivery-fee-email');
  if (se) se.value = itemName;
  if (te) te.value = 'R' + grand.toFixed(2);
  if (de) de.value = fee === 0 ? 'Free' : 'R' + fee.toFixed(2);
}

/* ============================================================
   PAYFAST — dynamically build & submit form
   ============================================================ */
function submitPayFast(firstName, lastName, email, phone) {
  var grand = cartTotal();
  if (grand <= 0 || cart.length === 0) {
    showToast('Your cart is empty. Please add products first.');
    return;
  }

  var itemName = cart.map(function(i) {
    return i.qty + 'x ' + i.name + ' (' + i.size + ')';
  }).join(', ').substring(0, 255);

  var base = window.location.href.replace(/[^/]*$/, '');

  var fields = {
    merchant_id:   PAYFAST_MERCHANT_ID,
    merchant_key:  PAYFAST_MERCHANT_KEY,
    return:        base + RETURN_URL,
    cancel_return: base + CANCEL_URL,
    amount:        grand.toFixed(2),
    item_name:     itemName,
    name_first:    firstName || '',
    name_last:     lastName  || '',
    email_address: email     || '',
    cell_number:   (phone    || '').replace(/\s/g, ''),
    m_payment_id:  'GSW-' + Date.now(),
    custom_str1:   selectedDelivery.label,
    custom_str2:   'Delivery: ' + (selectedDelivery.fee === 0 ? 'Free' : 'R' + selectedDelivery.fee)
  };

  var form = document.createElement('form');
  form.method = 'POST';
  form.action = PAYFAST_URL;
  form.target = '_self';

  Object.keys(fields).forEach(function(k) {
    var inp = document.createElement('input');
    inp.type  = 'hidden';
    inp.name  = k;
    inp.value = fields[k];
    form.appendChild(inp);
  });

  document.body.appendChild(form);

  /* Clear cart before redirect */
  cart = [];
  localStorage.removeItem('gsw_cart');

  form.submit();
}

/* ---- Validate checkout form then pay ---- */
function handleCheckout(method) {
  var form = document.getElementById('checkout-form');
  if (!form) return;

  if (!form.checkValidity()) {
    form.reportValidity();
    showToast('Please fill in all required fields.');
    return;
  }

  if (cart.length === 0) {
    showToast('Your cart is empty! Add some products first.');
    window.location.href = 'products.html';
    return;
  }

  var firstName = (form.querySelector('[name="firstname"]') || {}).value || '';
  var lastName  = (form.querySelector('[name="lastname"]')  || {}).value || '';
  var email     = (form.querySelector('[name="email"]')     || {}).value || '';
  var phone     = (form.querySelector('[name="phone"]')     || {}).value || '';

  if (method === 'payfast') {
    submitPayFast(firstName, lastName, email, phone);
  } else {
    /* COD: submit web3forms */
    form.submit();
  }
}

/* ---- Checkout redirect from products page ---- */
function goToCheckout() {
  if (cart.length === 0) {
    showToast('Your cart is empty! Add products first.');
    return;
  }
  window.location.href = 'payment.html';
}

/* ---- Toast notification ---- */
function showToast(msg) {
  var toast = document.getElementById('gsw-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'gsw-toast';
    toast.style.cssText = [
      'position:fixed', 'bottom:24px', 'right:20px', 'left:20px',
      'max-width:360px', 'margin:0 auto', 'z-index:99999',
      'background:var(--blue-dark)', 'color:white',
      'padding:13px 18px', 'border-radius:10px',
      'font-family:Barlow,sans-serif', 'font-size:14px', 'font-weight:600',
      'box-shadow:0 8px 32px rgba(0,0,0,0.28)',
      'transition:opacity 0.3s ease', 'opacity:0', 'line-height:1.4'
    ].join(';');
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(function() { toast.style.opacity = '0'; }, 3000);
}

/* ---- Navigation hamburger ---- */
function initNav() {
  var hamburger = document.querySelector('.nav-hamburger');
  var mobileNav = document.querySelector('.nav-mobile');
  if (!hamburger || !mobileNav) return;

  hamburger.addEventListener('click', function() {
    hamburger.classList.toggle('open');
    mobileNav.classList.toggle('open');
  });

  mobileNav.querySelectorAll('a').forEach(function(a) {
    a.addEventListener('click', function() {
      hamburger.classList.remove('open');
      mobileNav.classList.remove('open');
    });
  });

  var path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a, .nav-mobile a').forEach(function(a) {
    var href = a.getAttribute('href') || '';
    if (href === path || (path === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });
}

/* ---- Payment method UI toggle ---- */
function initPaymentMethodToggle() {
  var methods = document.querySelectorAll('.pay-method');
  if (!methods.length) return;
  methods.forEach(function(m) {
    m.addEventListener('click', function() {
      methods.forEach(function(x) { x.classList.remove('selected'); });
      m.classList.add('selected');
      var radio = m.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
      var eft = document.getElementById('eft-details');
      if (eft) eft.classList.toggle('visible', m.dataset.method === 'eft');
    });
  });
}

/* ---- Delivery radio init ---- */
function initDeliveryOptions() {
  var saved = localStorage.getItem('gsw_delivery');
  if (saved) {
    try {
      var d = JSON.parse(saved);
      selectedDelivery = d;
      var el = document.querySelector('input[data-key="' + d.key + '"]');
      if (el) el.checked = true;
    } catch(e) {}
  }
  document.querySelectorAll('.delivery-option input[type="radio"]').forEach(function(input) {
    input.addEventListener('change', function() {
      selectDelivery(input.dataset.key, input.dataset.label, parseFloat(input.dataset.fee));
    });
  });
}

/* ---- Checkout page delivery sync ---- */
function initCheckoutDeliverySync() {
  var feeMap = {
    collection: 0,
    bronk: 0,
    pretoria: 35,
    nationwide: 100
  };

  var labelMap = {
    collection: 'Free Collection',
    bronk: 'Free Bronkhorstspruit Delivery',
    pretoria: 'Pretoria Delivery',
    nationwide: 'Nationwide Delivery'
  };

  function syncSelectedDelivery() {
    var selected = document.querySelector('input[name="checkout_delivery"]:checked');

    if (!selected) return;

    var key = selected.value;
    var fee = feeMap[key] || 0;
    var label = labelMap[key] || key;

    selectDelivery(key, label, fee);

    var codButtons = document.querySelectorAll('.btn-cod');

    codButtons.forEach(function(btn) {
      btn.style.display = key === 'nationwide' ? 'none' : '';
    });
  }

  document.querySelectorAll('input[name="checkout_delivery"]').forEach(function(radio) {
    radio.addEventListener('change', syncSelectedDelivery);
  });

  syncSelectedDelivery();
}

/* ============================================================
   INIT
   ============================================================ */
/* ============================================================
   Global Safety Wear (Pty) Ltd — script.js
   Cart, PayFast Integration, Navigation
   ============================================================ */

const PAYFAST_MERCHANT_ID  = '18195722';
const PAYFAST_MERCHANT_KEY = '1ixywavgtvoql';
const PAYFAST_URL          = 'https://www.payfast.co.za/eng/process';
const RETURN_URL  = 'index.html';
const CANCEL_URL  = 'payment.html';

let cart = [];
try { cart = JSON.parse(localStorage.getItem('gsw_cart') || '[]'); } catch(e) { cart = []; }

let selectedDelivery = { label: 'Free Collection', fee: 0, key: 'collection' };
try {
  const saved = localStorage.getItem('gsw_delivery');
  if (saved) selectedDelivery = JSON.parse(saved);
} catch(e) {}

function saveCart() {
  localStorage.setItem('gsw_cart', JSON.stringify(cart));
  updateCartUI();
  updateNavCartCount();
}

function addToCart(id, name, price, size, qty, icon) {
  if (!qty || qty < 1) qty = 1;
  const existing = cart.find(i => i.id === id && i.size === size);
  if (existing) {
    existing.qty += parseInt(qty);
  } else {
    cart.push({ id, name, price: parseFloat(price), size, qty: parseInt(qty), icon: icon || '🧤' });
  }
  saveCart();
  showToast('✓  ' + name + ' (Size ' + size + ' × ' + qty + ') added to cart');
}

function removeFromCart(id, size) {
  cart = cart.filter(i => !(i.id === id && i.size === size));
  saveCart();
}

function cartSubtotal() {
  return cart.reduce(function(s, i) { return s + i.price * i.qty; }, 0);
}
function cartTotal() {
  return cartSubtotal() + (selectedDelivery.fee || 0);
}

function updateNavCartCount() {
  var total = cart.reduce(function(s, i) { return s + i.qty; }, 0);
  document.querySelectorAll('.cart-count').forEach(function(el) {
    el.textContent = total;
    el.style.display = total > 0 ? 'flex' : 'none';
  });
}

function updateCartUI() {
  var body  = document.getElementById('cart-body');
  var badge = document.getElementById('cart-count-badge');
  if (!body) return;

  var totalQty = cart.reduce(function(s, i) { return s + i.qty; }, 0);
  if (badge) badge.textContent = totalQty + ' item' + (totalQty !== 1 ? 's' : '');

  if (cart.length === 0) {
    body.innerHTML = '<div class="cart-empty"><span class="ico">🛒</span><p>Your cart is empty.</p><p>Add products to get started.</p></div>';
  } else {
    body.innerHTML = cart.map(function(item) {
      return '<div class="cart-item">' +
        '<div class="cart-item-icon">' + item.icon + '</div>' +
        '<div class="cart-item-info">' +
          '<h4>' + item.name + '</h4>' +
          '<span>Size: ' + item.size + ' &bull; Qty: ' + item.qty + '</span>' +
          '<span class="item-price">R' + (item.price * item.qty).toFixed(2) + '</span>' +
        '</div>' +
        '<button class="cart-item-remove" onclick="removeFromCart(\'' + item.id + '\',\'' + item.size + '\')" title="Remove">&times;</button>' +
      '</div>';
    }).join('');
  }
  updateTotals();
}

function updateTotals() {
  var sub   = cartSubtotal();
  var fee   = selectedDelivery.fee || 0;
  var grand = cartTotal();
  var feeStr = fee === 0 ? 'Free' : 'R' + fee.toFixed(2);

  function set(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; }
  set('cart-subtotal', 'R' + sub.toFixed(2));
  set('cart-delivery', feeStr);
  set('cart-total',    'R' + grand.toFixed(2));

  renderPaymentSummary();
}

function selectDelivery(key, label, fee) {
  selectedDelivery = { key: key, label: label, fee: parseFloat(fee) };
  localStorage.setItem('gsw_delivery', JSON.stringify(selectedDelivery));
  updateTotals();
}

function renderPaymentSummary() {
  var container       = document.getElementById('payment-items');
  var summaryDelivery = document.getElementById('summary-delivery');
  var summarySubtotal = document.getElementById('summary-subtotal');
  var summaryTotal    = document.getElementById('summary-total');
  if (!container) return;

  var sub   = cartSubtotal();
  var fee   = selectedDelivery.fee || 0;
  var grand = cartTotal();

  if (cart.length === 0) {
    container.innerHTML = '<div class="empty-summary"><span class="ico">🛒</span><p>No items in cart.<br><a href="products.html" style="color:var(--blue-mid)">Browse products</a></p></div>';
  } else {
    container.innerHTML = cart.map(function(item) {
      return '<div class="summary-item">' +
        '<div class="summary-item-name">' +
          '<strong>' + item.name + '</strong>' +
          '<small>Size: ' + item.size + ' &bull; Qty: ' + item.qty + '</small>' +
        '</div>' +
        '<div class="summary-item-price">R' + (item.price * item.qty).toFixed(2) + '</div>' +
      '</div>';
    }).join('');
  }

  if (summarySubtotal) summarySubtotal.textContent = 'R' + sub.toFixed(2);
  if (summaryDelivery) summaryDelivery.textContent = fee === 0 ? 'Free' : 'R' + fee.toFixed(2);
  if (summaryTotal)    summaryTotal.textContent    = 'R' + grand.toFixed(2);

  /* Sync amount into all PayFast hidden fields */
  var itemName = cart.length > 0
    ? cart.map(function(i) { return i.qty + 'x ' + i.name + ' (' + i.size + ')'; }).join(', ').substring(0, 255)
    : 'Global Safety Wear Order';

  document.querySelectorAll('.pf-amount').forEach(function(el)    { el.value = grand.toFixed(2); });
  document.querySelectorAll('.pf-item-name').forEach(function(el) { el.value = itemName; });

  /* web3forms hidden fields */
  var se = document.getElementById('order-summary-email');
  var te = document.getElementById('order-total-email');
  var de = document.getElementById('delivery-fee-email');
  if (se) se.value = itemName;
  if (te) te.value = 'R' + grand.toFixed(2);
  if (de) de.value = fee === 0 ? 'Free' : 'R' + fee.toFixed(2);
}

/* ============================================================
   PAYFAST — dynamically build & submit form
   ============================================================ */
function submitPayFast(firstName, lastName, email, phone) {
  var grand = cartTotal();
  if (grand <= 0 || cart.length === 0) {
    showToast('Your cart is empty. Please add products first.');
    return;
  }

  var itemName = cart.map(function(i) {
    return i.qty + 'x ' + i.name + ' (' + i.size + ')';
  }).join(', ').substring(0, 255);

  var base = window.location.href.replace(/[^/]*$/, '');

  var fields = {
    merchant_id:   PAYFAST_MERCHANT_ID,
    merchant_key:  PAYFAST_MERCHANT_KEY,
    return:        base + RETURN_URL,
    cancel_return: base + CANCEL_URL,
    amount:        grand.toFixed(2),
    item_name:     itemName,
    name_first:    firstName || '',
    name_last:     lastName  || '',
    email_address: email     || '',
    cell_number:   (phone    || '').replace(/\s/g, ''),
    m_payment_id:  'GSW-' + Date.now(),
    custom_str1:   selectedDelivery.label,
    custom_str2:   'Delivery: ' + (selectedDelivery.fee === 0 ? 'Free' : 'R' + selectedDelivery.fee)
  };

  var form = document.createElement('form');
  form.method = 'POST';
  form.action = PAYFAST_URL;
  form.target = '_self';

  Object.keys(fields).forEach(function(k) {
    var inp = document.createElement('input');
    inp.type  = 'hidden';
    inp.name  = k;
    inp.value = fields[k];
    form.appendChild(inp);
  });

  document.body.appendChild(form);

  /* Clear cart before redirect */
  cart = [];
  localStorage.removeItem('gsw_cart');

  form.submit();
}

/* ---- Validate checkout form then pay ---- */
function handleCheckout(method) {
  var form = document.getElementById('checkout-form');
  if (!form) return;

  if (!form.checkValidity()) {
    form.reportValidity();
    showToast('Please fill in all required fields.');
    return;
  }

  if (cart.length === 0) {
    showToast('Your cart is empty! Add some products first.');
    window.location.href = 'products.html';
    return;
  }

  var firstName = (form.querySelector('[name="firstname"]') || {}).value || '';
  var lastName  = (form.querySelector('[name="lastname"]')  || {}).value || '';
  var email     = (form.querySelector('[name="email"]')     || {}).value || '';
  var phone     = (form.querySelector('[name="phone"]')     || {}).value || '';

  if (method === 'payfast') {
    submitPayFast(firstName, lastName, email, phone);
  } else {
    /* COD: submit web3forms */
    form.submit();
  }
}

/* ---- Checkout redirect from products page ---- */
function goToCheckout() {
  if (cart.length === 0) {
    showToast('Your cart is empty! Add products first.');
    return;
  }
  window.location.href = 'payment.html';
}

/* ---- Toast notification ---- */
function showToast(msg) {
  var toast = document.getElementById('gsw-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'gsw-toast';
    toast.style.cssText = [
      'position:fixed', 'bottom:24px', 'right:20px', 'left:20px',
      'max-width:360px', 'margin:0 auto', 'z-index:99999',
      'background:var(--blue-dark)', 'color:white',
      'padding:13px 18px', 'border-radius:10px',
      'font-family:Barlow,sans-serif', 'font-size:14px', 'font-weight:600',
      'box-shadow:0 8px 32px rgba(0,0,0,0.28)',
      'transition:opacity 0.3s ease', 'opacity:0', 'line-height:1.4'
    ].join(';');
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(function() { toast.style.opacity = '0'; }, 3000);
}

/* ---- Navigation hamburger ---- */
function initNav() {
  var hamburger = document.querySelector('.nav-hamburger');
  var mobileNav = document.querySelector('.nav-mobile');
  if (!hamburger || !mobileNav) return;

  hamburger.addEventListener('click', function() {
    hamburger.classList.toggle('open');
    mobileNav.classList.toggle('open');
  });

  mobileNav.querySelectorAll('a').forEach(function(a) {
    a.addEventListener('click', function() {
      hamburger.classList.remove('open');
      mobileNav.classList.remove('open');
    });
  });

  var path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a, .nav-mobile a').forEach(function(a) {
    var href = a.getAttribute('href') || '';
    if (href === path || (path === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });
}

/* ---- Payment method UI toggle ---- */
function initPaymentMethodToggle() {
  var methods = document.querySelectorAll('.pay-method');
  if (!methods.length) return;
  methods.forEach(function(m) {
    m.addEventListener('click', function() {
      methods.forEach(function(x) { x.classList.remove('selected'); });
      m.classList.add('selected');
      var radio = m.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
      var eft = document.getElementById('eft-details');
      if (eft) eft.classList.toggle('visible', m.dataset.method === 'eft');
    });
  });
}

/* ---- Delivery radio init ---- */
function initDeliveryOptions() {
  var saved = localStorage.getItem('gsw_delivery');
  if (saved) {
    try {
      var d = JSON.parse(saved);
      selectedDelivery = d;
      var el = document.querySelector('input[data-key="' + d.key + '"]');
      if (el) el.checked = true;
    } catch(e) {}
  }
  document.querySelectorAll('.delivery-option input[type="radio"]').forEach(function(input) {
    input.addEventListener('change', function() {
      selectDelivery(input.dataset.key, input.dataset.label, parseFloat(input.dataset.fee));
    });
  });
}

/* ---- Checkout page delivery sync ---- */
function initCheckoutDeliverySync() {
  var feeMap = {
    collection: 0,
    bronk: 0,
    pretoria: 35,
    nationwide: 100
  };

  var labelMap = {
    collection: 'Free Collection',
    bronk: 'Free Bronkhorstspruit Delivery',
    pretoria: 'Pretoria Delivery',
    nationwide: 'Nationwide Delivery'
  };

  function syncSelectedDelivery() {
    var selected = document.querySelector('input[name="checkout_delivery"]:checked');

    if (!selected) return;

    var key = selected.value;
    var fee = feeMap[key] || 0;
    var label = labelMap[key] || key;

    selectDelivery(key, label, fee);

    var codButtons = document.querySelectorAll('.btn-cod');

    codButtons.forEach(function(btn) {
      btn.style.display = key === 'nationwide' ? 'none' : '';
    });
  }

  document.querySelectorAll('input[name="checkout_delivery"]').forEach(function(radio) {
    radio.addEventListener('change', syncSelectedDelivery);
  });

  syncSelectedDelivery();
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', function() {
  initNav();
  updateNavCartCount();
  updateCartUI();
  initDeliveryOptions();
  initCheckoutDeliverySync();
  updateTotals();
  initPaymentMethodToggle();
  renderPaymentSummary();
});
