import { createRouter, createWebHistory } from 'vue-router';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { currentUserProfile, logoutUser } from './services/store';

import LoginView from './views/auth/LoginView.vue';
import RegisterView from './views/auth/RegisterView.vue';

import HomeView from './views/customer/HomeView.vue';
import ProductsView from './views/customer/ProductsView.vue';
import CartView from './views/customer/CartView.vue';
import CheckoutView from './views/customer/CheckoutView.vue';
import AccountView from './views/customer/AccountView.vue';
import ProductDetailView from './views/customer/ProductDetailView.vue';
import OrderDetailsView from './views/customer/OrderDetailsView.vue';

import AdminView from './views/admin/AdminLayout.vue';

const routes = [
  { path: '/', redirect: '/auth/login' },

  // Authentication
  { path: '/auth/login', component: LoginView, meta: { guest: true } },
  { path: '/auth/register', component: RegisterView, meta: { guest: true } },

  // Customer
  { path: '/customer/home', component: HomeView, meta: { auth: true, role: 'customer' } },
  { path: '/customer/products', component: ProductsView, meta: { auth: true, role: 'customer' } },
  {
    path: '/customer/detailProducts/:id',
    component: ProductDetailView,
    meta: { auth: true, role: 'customer' },
  },
  {
    path: '/customer/wishlist',
    component: ProductsView,
    props: { wishlist: true },
    meta: { auth: true, role: 'customer' },
  },
  { path: '/customer/cart', component: CartView, meta: { auth: true, role: 'customer' } },
  { path: '/customer/checkout', component: CheckoutView, meta: { auth: true, role: 'customer' } },
  {
    path: '/customer/history',
    component: AccountView,
    props: { mode: 'history' },
    meta: { auth: true, role: 'customer' },
  },
  {
    path: '/customer/payment/:id',
    component: OrderDetailsView,
    meta: { auth: true, role: 'customer' },
  },
  {
    path: '/customer/tracking/:id',
    component: OrderDetailsView,
    meta: { auth: true, role: 'customer' },
  },

  { path: '/profile', component: AccountView, meta: { auth: true } },
  {
    path: '/notifications',
    component: AccountView,
    props: { mode: 'notifications' },
    meta: { auth: true },
  },

  // Admin
  { path: '/dashboard/:section?', component: AdminView, meta: { auth: true, role: 'admin' } },

  // Redirect lama
  { path: '/login', redirect: '/auth/login' },
  { path: '/register', redirect: '/auth/register' },
  { path: '/home', redirect: '/customer/home' },
  { path: '/products', redirect: '/customer/products' },
  { path: '/wishlist', redirect: '/customer/wishlist' },
  { path: '/cart', redirect: '/customer/cart' },
  { path: '/checkout', redirect: '/customer/checkout' },
  { path: '/history', redirect: '/customer/history' },
  { path: '/admin/:section?', redirect: (to) => `/dashboard/${to.params.section || ''}` },

  { path: '/:pathMatch(.*)*', redirect: '/auth/login' },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Menunggu Firebase selesai memeriksa sesi login
function waitForAuth() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

// Proteksi halaman
router.beforeEach(async (to) => {
  try {
    const user = await waitForAuth();

    // Pengguna belum login
    if (to.meta.auth && !user) {
      return {
        path: '/auth/login',
        query: { redirect: to.fullPath },
      };
    }

    if (!user) return true;

    // Ambil profil pengguna dari Firestore
    const profile = await currentUserProfile(user.uid);

    // Profil tidak ditemukan
    if (!profile) {
      await logoutUser();
      return '/auth/login';
    }

    const role = profile.role;

    // Pengguna sudah login, tidak perlu kembali ke login/register
    if (to.meta.guest) {
      return role === 'admin' ? '/dashboard' : '/customer/home';
    }

    // Pemeriksaan hak akses
    if (to.meta.role && role !== to.meta.role) {
      return role === 'admin' ? '/dashboard' : '/customer/home';
    }

    return true;
  } catch (error) {
    console.error('Router authentication error:', error);
    return '/auth/login';
  }
});

export default router;
