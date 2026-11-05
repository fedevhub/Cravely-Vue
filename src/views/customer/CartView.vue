<script setup>
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { onAuthStateChanged } from 'firebase/auth';
import CustomerNav from '../../components/CustomerNav.vue';
import { auth } from '../../firebase';
import { getCart, rupiah, updateCartItem } from '../../services/store';

const items = ref([]);
const loading = ref(true);
const error = ref('');
const busyIds = ref(new Set());

const total = computed(() =>
  items.value.reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
    0,
  ),
);

const itemCount = computed(() =>
  items.value.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
);

const cartGroups = computed(() =>
  [
    { key: 'sweet', title: 'Sweet Corner', icon: '🍬' },
    { key: 'savory', title: 'Savory Corner', icon: '🌿' },
    { key: 'other', title: 'Your Cravely Picks', icon: '🥨' },
  ]
    .map((group) => ({
      ...group,
      items: items.value.filter((item) =>
        group.key === 'other'
          ? item.category !== 'sweet' && item.category !== 'savory'
          : item.category === group.key,
      ),
    }))
    .filter((group) => group.items.length),
);

function waitForAuth() {
  if (auth.currentUser) {
    return Promise.resolve(auth.currentUser);
  }

  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

async function load() {
  loading.value = true;
  error.value = '';

  try {
    const user = await waitForAuth();

    if (!user) {
      items.value = [];
      error.value = 'Silakan login terlebih dahulu untuk melihat keranjang.';
      return;
    }

    items.value = await getCart(user.uid);
  } catch (err) {
    console.error('Gagal memuat keranjang:', err);
    error.value = 'Gagal memuat keranjang. Silakan coba lagi.';
  } finally {
    loading.value = false;
  }
}

async function change(item, quantity) {
  if (busyIds.value.has(item.id)) return;

  const user = auth.currentUser;

  if (!user) {
    error.value = 'Sesi login tidak ditemukan. Silakan login kembali.';
    return;
  }

  const newQuantity = Math.max(0, Math.min(5, Number(quantity) || 0));

  if (newQuantity === item.quantity) return;

  busyIds.value.add(item.id);
  error.value = '';

  try {
    await updateCartItem(user.uid, item.id, newQuantity);
    items.value = await getCart(user.uid);
  } catch (err) {
    console.error('Gagal mengubah keranjang:', err);
    error.value = 'Gagal mengubah jumlah produk. Silakan coba lagi.';
  } finally {
    busyIds.value.delete(item.id);
  }
}

onMounted(load);
</script>

<template>
  <CustomerNav />

  <main class="reference-page cart-reference">
    <RouterLink class="reference-back" to="/customer/products">
      <i class="bi bi-chevron-left" /> Continue Shopping
    </RouterLink>

    <h1>
      Shopping Cart <small>({{ itemCount }} item{{ itemCount === 1 ? '' : 's' }})</small>
    </h1>

    <p v-if="error" class="text-danger" role="alert">
      {{ error }}
    </p>

    <section v-if="loading" class="empty-reference">
      <p>Loading your shopping cart...</p>
    </section>

    <section v-else-if="!items.length" class="empty-reference">
      <i class="bi bi-bag" />
      <h2>Your cart is empty</h2>
      <p>Browse our Sweet and Savory Corners to fill it up.</p>
      <RouterLink class="reference-button" to="/customer/products">
        Browse Products
      </RouterLink>
    </section>

    <div v-else class="reference-grid">
      <section>
        <div v-for="group in cartGroups" :key="group.key" class="cart-section">
          <div class="cart-section-title">
            <span>{{ group.icon }}</span>
            <strong>{{ group.title }}</strong>
            <small>({{ group.items.length }} item{{ group.items.length === 1 ? '' : 's' }})</small>
          </div>

          <article v-for="item in group.items" :key="item.id" class="reference-item-card">
            <img :src="item.image || '/img/cookies.jpeg'" :alt="item.name" />

            <div class="reference-item-info">
              <h3>{{ item.name }}</h3>
              <p>{{ item.detail?.weight || '-' }} · {{ item.detail?.servings || '-' }}</p>

              <div class="reference-item-bottom">
                <div class="qty-control">
                  <button type="button" aria-label="Decrease quantity" :disabled="busyIds.has(item.id)"
                    @click="change(item, item.quantity - 1)">
                    −
                  </button>

                  <span>{{ item.quantity }}</span>

                  <button type="button" aria-label="Increase quantity"
                    :disabled="busyIds.has(item.id) || item.quantity >= 5" @click="change(item, item.quantity + 1)">
                    +
                  </button>
                </div>

                <div class="reference-item-price">
                  {{ rupiah(item.price * item.quantity) }}

                  <button class="remove-button" type="button" title="Remove" aria-label="Remove item"
                    :disabled="busyIds.has(item.id)" @click="change(item, 0)">
                    <i class="bi bi-trash" />
                  </button>
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>

      <aside class="reference-summary">
        <h2>Order Summary</h2>

        <div class="summary-items">
          <div v-for="item in items" :key="item.id">
            <span>{{ item.name }} ×{{ item.quantity }}</span>
            <b>{{ rupiah(item.price * item.quantity) }}</b>
          </div>
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

        <RouterLink class="reference-button full" to="/customer/checkout">
          Proceed to Checkout <i class="bi bi-arrow-right" />
        </RouterLink>

        <div class="payment-pills">
          <span>🏦 Bank Transfer</span>
          <span>💳 E-Wallet</span>
        </div>

        <div class="preorder-note">
          <strong>Pre-order note:</strong> Items are made fresh for each batch. Please complete
          payment within 24 hours.
        </div>
      </aside>
    </div>
  </main>
</template>
