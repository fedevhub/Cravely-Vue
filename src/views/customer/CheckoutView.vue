<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import CustomerNav from '../../components/CustomerNav.vue';
import { auth } from '../../firebase';

import {
  createOrder,
  currentUserProfile,
  getCart,
  rupiah,
} from '../../services/store';

const router = useRouter();

const items = ref([]);

const loading = ref(true);
const submitting = ref(false);
const errorMessage = ref('');

const form = reactive({
  fullname: '',
  email: '',
  phoneNumber: '',
  shippingAddress: '',
  city: '',
  province: '',
  postal: '',
  customerNote: '',
  paymentMethod: 'Transfer',
});

const total = computed(() =>
  items.value.reduce(
    (sum, item) =>
      sum + (Number(item.price) || 0) * (Number(item.quantity) || 0),
    0,
  ),
);

// =====================================
// LOAD CHECKOUT DATA
// =====================================

async function loadCheckout() {
  errorMessage.value = '';

  if (!auth.currentUser) {
    errorMessage.value = 'Silakan login terlebih dahulu.';
    loading.value = false;
    return;
  }

  loading.value = true;

  try {
    const uid = auth.currentUser.uid;

    const [cartData, profile] = await Promise.all([
      getCart(uid),
      currentUserProfile(uid),
    ]);

    items.value = cartData;

    form.fullname =
      profile?.fullname || profile?.nama || '';

    form.email =
      profile?.email || auth.currentUser.email || '';

    form.phoneNumber =
      profile?.phoneNumber || '';

    form.shippingAddress =
      profile?.address || '';
  } catch (error) {
    console.error('Gagal memuat checkout:', error);

    errorMessage.value =
      'Gagal memuat data checkout. Periksa koneksi atau izin Firebase.';
  } finally {
    loading.value = false;
  }
}

onMounted(loadCheckout);

// =====================================
// SUBMIT ORDER
// =====================================

async function submit() {
  errorMessage.value = '';

  if (!auth.currentUser) {
    errorMessage.value = 'Silakan login terlebih dahulu.';
    return;
  }

  if (submitting.value) return;

  if (!items.value.length) {
    errorMessage.value = 'Keranjang kamu masih kosong.';
    return;
  }

  if (!form.fullname.trim() || !form.phoneNumber.trim() || !form.shippingAddress.trim()) {
    errorMessage.value = 'Lengkapi informasi pengiriman terlebih dahulu.';
    return;
  }

  submitting.value = true;

  try {
    const orderData = {
      items: items.value.map((item) => ({
        productId: item.productId || item.id,
        name: item.name || 'Product',
        image: item.image || '',
        price: Number(item.price) || 0,
        quantity: Number(item.quantity) || 1,
      })),

      totalAmount: total.value,

      customerName: form.fullname.trim(),
      email: form.email.trim(),
      phoneNumber: form.phoneNumber.trim(),

      shippingAddress: form.shippingAddress.trim(),
      city: form.city.trim(),
      province: form.province,
      postal: form.postal.trim(),

      customerNote: form.customerNote.trim(),
      paymentMethod: form.paymentMethod,
    };

    const id = await createOrder(orderData);

    await router.push(`/customer/history?created=${id}`);
  } catch (error) {
    console.error('Gagal membuat pesanan:', error);

    errorMessage.value =
      'Pesanan gagal dibuat. Silakan coba lagi.';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <CustomerNav />

  <main class="reference-page checkout-reference">
    <RouterLink class="reference-back" to="/customer/cart">
      <i class="bi bi-chevron-left" /> Back to Cart
    </RouterLink>

    <h1>Checkout</h1>

    <div class="checkout-steps">
      <span class="active"><b>1</b> Shipping</span>
      <i />
      <span class="active"><b>2</b> Payment</span>
      <i />
      <span><b>3</b> Review</span>
    </div>

    <div class="reference-grid">
      <form class="reference-form-card" @submit.prevent="submit">
        <div v-if="errorMessage" class="alert alert-danger">
          {{ errorMessage }}
        </div>

        <h2><i class="bi bi-geo-alt" /> Shipping Information</h2>

        <div class="form-grid-reference">
          <label class="full">
            Full Name
            <input v-model="form.fullname" required />
          </label>

          <label>
            Email
            <input v-model="form.email" type="email" />
          </label>

          <label>
            Phone Number
            <input v-model="form.phoneNumber" required />
          </label>

          <label class="full">
            Street Address
            <textarea v-model="form.shippingAddress" rows="3" required />
          </label>

          <label>
            City
            <input v-model="form.city" placeholder="Jakarta Selatan" />
          </label>

          <label>
            Province
            <select v-model="form.province">
              <option value="">Select province</option>
              <option>Jawa Timur</option>
              <option>Jawa Barat</option>
              <option>DKI Jakarta</option>
            </select>
          </label>

          <label>
            Postal Code
            <input v-model="form.postal" placeholder="12345" />
          </label>

          <label class="full">
            Delivery Notes <small>(optional)</small>
            <textarea v-model="form.customerNote" placeholder="e.g. Leave at door, call before delivery..." />
          </label>

          <label class="full">
            Payment Method
            <select v-model="form.paymentMethod">
              <option value="Transfer">🏦 BCA Bank Transfer</option>
              <option value="QRIS">💳 QRIS / E-Wallet</option>
              <option value="COD">💵 COD</option>
            </select>
          </label>
        </div>

        <button class="reference-button" type="submit" :disabled="!items.length || loading || submitting">
          {{ submitting ? 'Processing...' : 'Place Order' }}
          <i class="bi bi-arrow-right" />
        </button>
      </form>

      <aside class="reference-summary checkout-summary">
        <h2>Order Summary ({{ items.length }} items)</h2>

        <div v-for="item in items" :key="item.id" class="summary-product">
          <img :src="item.image || '/img/cookies.jpeg'" :alt="item.name" />

          <span>{{ item.name }} ×{{ item.quantity }}</span>

          <b>{{ rupiah(item.price * item.quantity) }}</b>
        </div>

        <div class="summary-line">
          <span>Subtotal</span>
          <b>{{ rupiah(total) }}</b>
        </div>

        <div class="summary-line">
          <span>Shipping</span>
          <b>Free</b>
        </div>

        <div class="summary-total">
          <span>Total</span>
          <b>{{ rupiah(total) }}</b>
        </div>

        <div class="delivery-note">
          📦 <strong>Estimated delivery:</strong>
          based on the active pre-order batch.
        </div>
      </aside>
    </div>
  </main>
</template>
