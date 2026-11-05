<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import CustomerNav from '../../components/CustomerNav.vue';
import { auth, db } from '../../firebase';
import {
  getOrders,
  currentUserProfile,
  rupiah,
} from '../../services/store';
import { doc, updateDoc } from 'firebase/firestore';

const props = defineProps({ mode: String });

const profile = reactive({});
const orders = ref([]);

const search = ref('');
const statusFilter = ref('');

const message = ref('');
const errorMessage = ref('');

const loading = ref(false);
const saving = ref(false);

const filteredOrders = computed(() => {
  const term = search.value.trim().toLowerCase();

  return orders.value.filter((order) => {
    const matchesStatus =
      !statusFilter.value || order.status === statusFilter.value;

    const productNames = (order.items || [])
      .map((item) => item.name || '')
      .join(' ');

    const matchesSearch = `${order.orderNumber || ''} ${productNames}`
      .toLowerCase()
      .includes(term);

    return matchesStatus && matchesSearch;
  });
});

const totalSpent = computed(() =>
  orders.value.reduce(
    (sum, order) => sum + (Number(order.totalAmount) || 0),
    0,
  ),
);

const completedOrders = computed(
  () => orders.value.filter((order) => order.status === 'Completed').length,
);

// =====================================
// LOAD PROFILE / ORDER HISTORY
// =====================================

async function loadData() {
  message.value = '';
  errorMessage.value = '';

  if (!auth.currentUser) {
    errorMessage.value = 'Silakan login terlebih dahulu.';
    return;
  }

  loading.value = true;

  try {
    if (props.mode === 'history') {
      orders.value = await getOrders(auth.currentUser.uid);
      return;
    }

    if (!props.mode) {
      const userData = await currentUserProfile(auth.currentUser.uid);

      if (!userData) {
        errorMessage.value = 'Data profil tidak ditemukan.';
        return;
      }

      Object.assign(profile, userData);

      // Mendukung nama dari data lama yang menggunakan field "nama".
      profile.fullname = profile.fullname || profile.nama || '';
      profile.username = profile.username || '';
      profile.phoneNumber = profile.phoneNumber || '';
      profile.address = profile.address || '';
      profile.email = profile.email || auth.currentUser.email || '';
    }
  } catch (error) {
    console.error('Gagal memuat data:', error);

    errorMessage.value =
      'Gagal memuat data. Periksa koneksi atau izin Firebase.';
  } finally {
    loading.value = false;
  }
}

onMounted(loadData);

// =====================================
// SAVE PROFILE
// =====================================

async function save() {
  message.value = '';
  errorMessage.value = '';

  if (!auth.currentUser) {
    errorMessage.value = 'Silakan login terlebih dahulu.';
    return;
  }

  if (saving.value) return;

  saving.value = true;

  try {
    await updateDoc(doc(db, 'users', auth.currentUser.uid), {
      fullname: profile.fullname.trim(),
      username: profile.username.trim(),
      phoneNumber: profile.phoneNumber.trim(),
      address: profile.address.trim(),
    });

    message.value = 'Profile updated successfully.';
  } catch (error) {
    console.error('Gagal menyimpan profil:', error);

    errorMessage.value =
      'Gagal menyimpan profil. Silakan coba lagi.';
  } finally {
    saving.value = false;
  }
}

// =====================================
// FORMAT DATE
// =====================================

function formatDate(value) {
  if (!value) return 'Date unavailable';

  const date = value?.toDate
    ? value.toDate()
    : new Date(value);

  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
    }).format(date);
}
</script>

<template>
  <CustomerNav />

  <!-- ORDER HISTORY -->
  <main v-if="mode === 'history'" class="reference-page history-reference">
    <h1>Order History</h1>
    <p class="reference-lead">{{ orders.length }} orders total</p>

    <div v-if="errorMessage" class="alert alert-danger">
      {{ errorMessage }}
    </div>

    <div class="history-toolbar">
      <div>
        <i class="bi bi-search" />
        <input v-model="search" placeholder="Search by order ID or product name..." />
      </div>

      <select v-model="statusFilter" aria-label="Filter by order status">
        <option value="">All Status</option>
        <option>Waiting Payment</option>
        <option>Payment Verification</option>
        <option>Confirmed</option>
        <option>In Production</option>
        <option>Ready for Delivery</option>
        <option>Delivered</option>
        <option>Completed</option>
        <option>Rejected</option>
      </select>
    </div>

    <div class="history-stats">
      <div>
        <strong>{{ orders.length }}</strong>
        <span>Total Orders</span>
      </div>

      <div>
        <strong>{{ completedOrders }}</strong>
        <span>Completed</span>
      </div>

      <div>
        <strong>{{ rupiah(totalSpent) }}</strong>
        <span>Total Spent</span>
      </div>
    </div>

    <section class="history-list">
      <article v-for="order in filteredOrders" :key="order.id" class="history-card">
        <div class="history-card-head">
          <strong>{{ order.orderNumber || order.id }}</strong>
          <span class="customer-badge">{{ order.status || 'Unknown' }}</span>
        </div>

        <div class="history-card-body">
          <div class="history-images">
            <img v-for="item in (order.items || []).slice(0, 3)" :key="item.productId || item.id || item.name"
              :src="item.image || '/img/cookies.jpeg'" :alt="item.name || 'Product'" />
          </div>

          <div class="history-card-info">
            <strong>
              {{
                (order.items || [])
                  .map((item) => `${item.name || 'Product'} ×${item.quantity || 1}`)
                  .join(', ') || 'Order details unavailable'
              }}
            </strong>

            <small>Ordered: {{ formatDate(order.createdAt) }}</small>
          </div>

          <b class="customer-price">
            {{ rupiah(order.totalAmount) }}
          </b>
        </div>

        <div class="history-actions">
          <RouterLink :to="`/customer/tracking/${order.id}`">
            <i class="bi bi-chevron-right" /> Track Order
          </RouterLink>

          <RouterLink :to="`/customer/payment/${order.id}`">
            <i class="bi bi-receipt" /> Payment
          </RouterLink>
        </div>
      </article>

      <div v-if="!filteredOrders.length" class="empty-reference">
        <i class="bi bi-box-seam" />

        <h2>
          {{ orders.length ? 'No matching orders' : 'No orders yet' }}
        </h2>

        <p>
          {{
            orders.length
              ? 'Try a different search or status.'
              : 'Your orders will appear here.'
          }}
        </p>
      </div>
    </section>
  </main>

  <!-- NOTIFICATIONS -->
  <main v-else-if="mode === 'notifications'" class="customer-shell notifications-content">
    <header class="notifications-header">
      <div>
        <p class="profile-eyebrow">YOUR UPDATES</p>
        <h1>Notifications</h1>
        <p class="profile-subtitle">
          Stay up to date with your orders and account.
        </p>
      </div>
    </header>

    <section class="notification-card">
      <div class="empty-reference">
        <i class="bi bi-bell" />
        <h2>No notifications yet</h2>
        <p>Updates about your orders will appear here.</p>
      </div>
    </section>
  </main>

  <!-- PROFILE -->
  <main v-else class="customer-shell profile-content">
    <header class="profile-header">
      <div>
        <p class="profile-eyebrow">ACCOUNT SETTINGS</p>
        <h1>My Profile</h1>
        <p class="profile-subtitle">
          Manage your account information and contact details.
        </p>
      </div>
    </header>

    <section class="profile-card">
      <div class="profile-identity">
        <div class="avatar-initial">
          {{ (profile.fullname || 'U').slice(0, 1).toUpperCase() }}
        </div>

        <div>
          <h2>{{ profile.fullname || 'Cravely Customer' }}</h2>

          <p>
            <i class="bi bi-shield-check" />
            {{ profile.role === 'admin' ? 'Administrator' : 'Customer' }}
          </p>
        </div>
      </div>

      <form class="customer-form profile-form" @submit.prevent="save">
        <div v-if="message" class="alert alert-success">
          {{ message }}
        </div>

        <div v-if="errorMessage" class="alert alert-danger">
          {{ errorMessage }}
        </div>

        <div class="profile-form-grid">
          <label>
            Full name
            <input v-model="profile.fullname" required />
          </label>

          <label>
            Username
            <input v-model="profile.username" required />
          </label>

          <label>
            Email
            <input :value="profile.email" type="email" disabled />
          </label>

          <label>
            Phone number
            <input v-model="profile.phoneNumber" required />
          </label>

          <label class="full-field">
            Address
            <textarea v-model="profile.address" required />
          </label>
        </div>

        <div class="profile-form-actions">
          <button class="customer-button" type="submit" :disabled="saving || loading">
            <i class="bi bi-check2" />
            {{ saving ? 'Saving...' : 'Save changes' }}
          </button>
        </div>
      </form>
    </section>
  </main>
</template>
