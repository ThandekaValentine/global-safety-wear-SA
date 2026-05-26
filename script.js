/* ============================================================
   Global Safety Wear (Pty) Ltd — script.js
   Cart, PayFast Integration, Navigation
   ============================================================ */

const PAYFAST_MERCHANT_ID  = '18195722';
const PAYFAST_MERCHANT_KEY = '1ixywavgtvoql';
const PAYFAST_URL          = 'https://www.payfast.co.za/eng/process';
const RETURN_URL  = 'index.html';
const CANCEL_URL  = 'payment.html';

/* Nitrile glove product IDs that count toward the 10-box minimum */
const NITRILE_IDS = ['blue', 'purple', 'black', 'blue-nitrile', 'purple-nitrile', 'black-nitrile'];

let cart = [];
try { cart = JSON.parse(localStorage.getItem('gsw_cart') || '[]'); } catch(e) { cart = []; }

let selectedDelivery = { label: 'Free Collection', fee: 0, key: 'collection' };
try {
  const saved = localStorage.getItem('gsw_delivery');
  if (saved) selectedDelivery = JSON.parse(saved);
} catch(e) {}

/* Count total nitrile glove boxes in cart */
function nitrileBoxCount() {
  return cart.reduce(function(sum, item) {
    if (NITRILE_IDS.indexOf(item.id) !== -1) {
      return sum + item.qty;
    }
    return sum;
  }, 0);
}

function saveCart() {
  localStorage.setItem('gsw_cart', JSON.stringify(cart));
  updateCartUI();
  updateNavCartCount();
}

function addToCart(id, name, price, size, qty, icon) {
  qty = parseInt(qty) || 1;
  if (qty < 1) qty = 1;
  const existing = cart.find(function(i) { return i.id === id && i.size === size; });
  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({ id: id, name: name, price: parseFloat(price), size: size, qty: qty, icon: icon || '🧤' });
  }
  saveCart();
  showToast('✓  ' + name + ' (Size ' + size + ' × ' + qty + ') added to cart');
}

function removeFromCart(id, size) {
  cart = cart.filter(function(i) { return !(i.id === id && i.size === size); });
  saveCart();
}

function cartSubtotal() {
  return cart.reduce(function(s, i) { return s + i.price * i.qty; }, 0);
}

function getDeliveryFee(key) {
  if (key === 'collection') return 0;
  if (key === 'bronk') {
    /* Free only if 10+ nitrile glove boxes; otherwise R35 */
    return nitrileBoxCount() >= 10 ? 0 : 35;
  }
  if (key === 'pretoria') return 35;
  if (key === 'nationwide') return 100;
  return 0;
}

function cartTotal() {
  return cartSubtotal() + getDeliveryFee(selectedDelivery.key);
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
        '<div class="cart-item-icon">' + (item.icon || '🧤') + '</div>' +
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
  var fee   = getDeliveryFee(selectedDelivery.key);
  var grand = sub + fee;
  var feeStr = fee === 0 ? 'Free' : 'R' + fee.toFixed(2);

  /* Show Bronkhorstspruit note if applicable */
  var bronkNote = '';
  if (selectedDelivery.key === 'bronk' && fee > 0) {
    var boxesNeeded = 10 - nitrileBoxCount();
    bronkNote = '<div style="font-size:12px;color:#e65100;margin-top:6px;">Add ' + boxesNeeded + ' more glove box(es) for free delivery!</div>';
  }

  function set(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; }
  set('cart-subtotal', 'R' + sub.toFixed(2));
  set('cart-delivery', feeStr);
  set('cart-total',    'R' + grand.toFixed(2));

  var noteEl = document.getElementById('bronk-note');
  if (noteEl) noteEl.innerHTML = bronkNote;

  renderPaymentSummary();
}

function selectDelivery(key, label, fee) {
  /* fee param is ignored — we compute it dynamically */
  var computedFee = getDeliveryFee(key);
  selectedDelivery = { key: key, label: label, fee: computedFee };
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
  var fee   = getDeliveryFee(selectedDelivery.key);
  var grand = sub + fee;

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

  var itemName = cart.length > 0
    ? cart.map(function(i) { return i.qty + 'x ' + i.name + ' (' + i.size + ')'; }).join(', ').substring(0, 255)
    : 'Global Safety Wear Order';

  document.querySelectorAll('.pf-amount').forEach(function(el)    { el.value = grand.toFixed(2); });
  document.querySelectorAll('.pf-item-name').forEach(function(el) { el.value = itemName; });

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
    custom_str2:   'Delivery: ' + (getDeliveryFee(selectedDelivery.key) === 0 ? 'Free' : 'R' + getDeliveryFee(selectedDelivery.key))
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

  cart = [];
  localStorage.removeItem('gsw_cart');
  localStorage.removeItem('gsw_delivery');

  form.submit();
}

/* ---- Validate checkout form then pay ---- */
function handleCheckout(method) {
  var form = document.getElementById('checkout-form');
  if (!form) return;

  if (cart.length === 0) {
    showToast('Your cart is empty! Add some products first.');
    window.location.href = 'products.html';
    return;
  }

  if (!form.checkValidity()) {
    form.reportValidity();
    showToast('Please fill in all required fields.');
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

/* ---- COD modal close ---- */
function closeModal() {
  var modal = document.getElementById('success-modal');
  if (modal) modal.classList.remove('visible');
  cart = [];
  localStorage.removeItem('gsw_cart');
  localStorage.removeItem('gsw_delivery');
  window.location.href = 'index.html';
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
  toast._timer = setTimeout(function() { toast.style.opacity = '0'; }, 3200);
}

/* ---- Navigation hamburger ---- */
function initNav() {
  var hamburger = document.querySelector('.nav-hamburger');
  var mobileNav = document.querySelector('.nav-mobile');
  if (!hamburger || !mobileNav) return;

  hamburger.addEventListener('click', function(e) {
    e.stopPropagation();
    var isOpen = mobileNav.classList.contains('open');
    if (isOpen) {
      mobileNav.classList.remove('open');
      hamburger.classList.remove('open');
    } else {
      mobileNav.classList.add('open');
      hamburger.classList.add('open');
    }
  });

  mobileNav.querySelectorAll('a').forEach(function(a) {
    a.addEventListener('click', function() {
      hamburger.classList.remove('open');
      mobileNav.classList.remove('open');
    });
  });

  document.addEventListener('click', function(e) {
    if (!hamburger.contains(e.target) && !mobileNav.contains(e.target)) {
      hamburger.classList.remove('open');
      mobileNav.classList.remove('open');
    }
  });

  /* Active link highlighting */
  var path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a, .nav-mobile a').forEach(function(a) {
    var href = a.getAttribute('href') || '';
    if (href === path || (path === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });
}

/* ---- Delivery radio init (products page cart sidebar) ---- */
function initDeliveryOptions() {
  document.querySelectorAll('.delivery-option input[type="radio"]').forEach(function(input) {
    input.addEventListener('change', function() {
      selectDelivery(input.dataset.key, input.dataset.label, 0);
    });
  });
}

/* ---- Checkout page delivery sync ---- */
function initCheckoutDeliverySync() {
  var labelMap = {
    collection: 'Free Collection',
    bronk: 'Bronkhorstspruit Delivery',
    pretoria: 'Pretoria Delivery',
    nationwide: 'Nationwide Delivery'
  };

  function syncSelectedDelivery() {
    var selected = document.querySelector('input[name="checkout_delivery"]:checked');
    if (!selected) return;

    var key = selected.value;
    var label = labelMap[key] || key;
    var fee = getDeliveryFee(key);

    selectedDelivery = { key: key, label: label, fee: fee };
    localStorage.setItem('gsw_delivery', JSON.stringify(selectedDelivery));

    updateTotals();
    renderPaymentSummary();

    /* Hide COD for nationwide */
    document.querySelectorAll('.btn-cod').forEach(function(btn) {
      if (key === 'nationwide') {
        btn.style.setProperty('display', 'none', 'important');
      } else {
        btn.style.setProperty('display', 'flex', 'important');
      }
    });

    /* Update Bronkhorstspruit label to reflect actual fee */
    var bronkLabel = document.getElementById('bronk-delivery-label');
    if (bronkLabel && key === 'bronk') {
      if (nitrileBoxCount() >= 10) {
        bronkLabel.textContent = 'Free';
        bronkLabel.style.color = 'var(--green-dark)';
      } else {
        bronkLabel.textContent = 'R35';
        bronkLabel.style.color = 'var(--blue-dark)';
      }
    }
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
  updateTotals();
  renderPaymentSummary();
  initCheckoutDeliverySync();
});
