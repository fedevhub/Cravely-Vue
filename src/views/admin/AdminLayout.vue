<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { auth } from '../../firebase';

import {
  currentUserProfile,
  getAllOrders,
  getProducts,
  rupiah,
  updateOrderStatus,
} from '../../services/store';

const route = useRoute();

const section = computed(() => route.params.section || 'dashboard');

const products = ref([]);
const orders = ref([]);
const admin = ref({});

const loading = ref(false);
const loadError = ref('');

const adminPages = [
  ['', 'bi-grid', 'Dashboard'],
  ['products', 'bi-box', 'Products'],
  ['users', 'bi-people', 'Users'],
  ['orders', 'bi-bag', 'Orders'],
  ['payments', 'bi-credit-card', 'Payments'],
  ['reviews', 'bi-star', 'Reviews'],
  ['inventory', 'bi-archive', 'Inventory'],
  ['analytics', 'bi-bar-chart', 'Analytics'],
];

const sales = computed(() =>
  orders.value.reduce(
    (sum, order) => sum + (Number(order.totalAmount) || 0),
    0,
  ),
);

const pendingPayments = computed(() =>
  orders.value.filter((order) =>
    ['Waiting Payment', 'Payment Verification'].includes(order.status),
  ).length,
);

const statusCounts = computed(() => {
  const counts = new Map();

  orders.value.forEach((order) => {
    const status = order.status || 'Unknown';

    counts.set(status, (counts.get(status) || 0) + 1);
  });

  return [...counts.entries()];
});

const title = computed(() => {
  if (section.value === 'dashboard') return 'Dashboard Overview';

  return section.value[0].toUpperCase() + section.value.slice(1);
});

// =====================================
// LOAD ADMIN DATA
// =====================================

async function load() {
  if (!auth.currentUser) {
    loadError.value = 'Pengguna belum login.';
    return;
  }

  loading.value = true;
  loadError.value = '';

  try {
    const results = await Promise.allSettled([
      getProducts(),
      getAllOrders(),
      currentUserProfile(auth.currentUser.uid),
    ]);

    // PRODUCTS
    if (results[0].status === 'fulfilled') {
      products.value = results[0].value;
    } else {
      console.error('Gagal mengambil produk:', results[0].reason);
    }

    // ORDERS
    if (results[1].status === 'fulfilled') {
      orders.value = results[1].value;
    } else {
      console.error('Gagal mengambil pesanan:', results[1].reason);
    }

    // ADMIN PROFILE
    if (results[2].status === 'fulfilled') {
      admin.value = results[2].value || {};
    } else {
      console.error('Gagal mengambil profil admin:', results[2].reason);
    }

    const failed = results.filter(
      (result) => result.status === 'rejected',
    );

    if (failed.length > 0) {
      loadError.value =
        'Beberapa data gagal dimuat. Periksa koneksi atau izin Firebase.';
    }
  } catch (error) {
    console.error('Admin dashboard error:', error);

    loadError.value = 'Terjadi kesalahan saat memuat dashboard.';
  } finally {
    loading.value = false;
  }
}

onMounted(load);

watch(section, () => {
  load();
});

// =====================================
// UPDATE ORDER STATUS
// =====================================

async function updateStatus(order, event) {
  const newStatus = event.target.value;

  try {
    await updateOrderStatus(order.id, newStatus);

    order.status = newStatus;

    await load();
  } catch (error) {
    console.error('Gagal mengubah status pesanan:', error);

    alert('Gagal mengubah status pesanan. Periksa izin Firebase.');

    event.target.value = order.status;
  }
}

// =====================================
// STATUS CLASS
// =====================================

function statusClass(status) {
  return (status || 'unknown')
    .toLowerCase()
    .replaceAll(' ', '-');
}
</script>
