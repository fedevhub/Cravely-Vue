<script setup>
import { onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { auth } from '../firebase';
import { getCart, getWishlist, logoutUser } from '../services/store';
const router = useRouter();
const route = useRoute();
const cartCount = ref(0);
const wishlistCount = ref(0);
const menuOpen = ref(false);
async function refresh() {
  if (!auth.currentUser) return;
  cartCount.value = (await getCart(auth.currentUser.uid)).reduce((sum, x) => sum + x.quantity, 0);
  wishlistCount.value = (await getWishlist(auth.currentUser.uid)).length;
}
onMounted(refresh);
watch(
  () => route.fullPath,
  () => (menuOpen.value = false),
);
defineExpose({ refresh });
async function logout() {
  await logoutUser();
  router.push('/auth/login');
}
</script>
<template>
  <nav class="navbar navbar-expand-lg custom-navbar">
    <div class="container-fluid px-4">
      <RouterLink class="navbar-brand d-flex align-items-center gap-3" to="/customer/home"
        ><div class="logo-circle">C</div>
        <span class="brand-name">Cravely</span></RouterLink
      >
      <button
        class="navbar-toggler"
        type="button"
        :aria-expanded="menuOpen"
        aria-controls="navbarMenu"
        aria-label="Toggle navigation"
        @click="menuOpen = !menuOpen"
      >
        <span class="navbar-toggler-icon" />
      </button>
      <div
        id="navbarMenu"
        class="collapse navbar-collapse justify-content-center"
        :class="{ show: menuOpen }"
      >
        <ul class="navbar-nav gap-lg-4">
          <li>
            <RouterLink class="nav-link" active-class="active-pill" to="/customer/home"
              >Home</RouterLink
            >
          </li>
          <li>
            <RouterLink
              class="nav-link"
              active-class="active-pill"
              :to="{ path: '/customer/products', query: { category: 'sweet' } }"
              >Sweet Corner</RouterLink
            >
          </li>
          <li>
            <RouterLink
              class="nav-link"
              active-class="active-pill"
              :to="{ path: '/customer/products', query: { category: 'savory' } }"
              >Savory Corner</RouterLink
            >
          </li>
        </ul>
      </div>
      <div class="d-flex align-items-center gap-4 nav-icons">
        <RouterLink class="nav-icon-link" to="/customer/wishlist"
          ><i class="bi bi-heart" /><span
            v-if="wishlistCount"
            class="navbar-badge wishlist-badge"
            >{{ wishlistCount }}</span
          ></RouterLink
        ><RouterLink class="nav-icon-link" to="/customer/cart"
          ><i class="bi bi-cart3" /><span v-if="cartCount" class="navbar-badge cart-badge">{{
            cartCount
          }}</span></RouterLink
        ><RouterLink to="/profile"><i class="bi bi-person" /></RouterLink
        ><RouterLink to="/customer/history"><i class="bi bi-clock-history" /></RouterLink
        ><button class="btn btn-sm btn-outline-danger" @click="logout">Logout</button>
      </div>
    </div>
  </nav>
</template>
