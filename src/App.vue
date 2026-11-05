<script setup>
import { ref, onMounted, watchEffect } from 'vue';
import { RouterView, useRoute } from 'vue-router';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebase';

const ready = ref(false);
const route = useRoute();

// Mengatur class berdasarkan halaman
watchEffect(() => {
  const isAdmin = route.path.startsWith('/dashboard');
  const isAuth = route.path.startsWith('/auth/');

  const isCustomer =
    (route.path.startsWith('/customer') &&
      route.path !== '/customer/home') ||
    route.path === '/profile' ||
    route.path === '/notifications';

  document.body.classList.toggle('admin-dashboard-page', isAdmin);
  document.body.classList.toggle('auth-screen', isAuth);
  document.body.classList.toggle('customer-page', isCustomer);
});

// Memeriksa status login Firebase
onMounted(() => {
  onAuthStateChanged(auth, () => {
    ready.value = true;
  });
});
</script>

<template>
  <RouterView v-if="ready" />
</template>
