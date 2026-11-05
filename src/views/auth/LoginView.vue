<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { currentUserProfile, loginUser } from '../../services/store';

const router = useRouter();
const route = useRoute();

const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function submit() {
    try {
        loading.value = true;
        error.value = '';

        // Login menggunakan Firebase Authentication
        const credential = await loginUser(
            email.value.trim(),
            password.value
        );

        // Ambil data pengguna dari Firestore
        const profile = await currentUserProfile(
            credential.user.uid
        );

        if (!profile) {
            throw new Error('Profil pengguna tidak ditemukan di Firestore.');
        }

        // Tentukan halaman berdasarkan role
        const destination = profile.role === 'admin'
            ? '/dashboard'
            : '/customer/home';

        // Periksa apakah ada halaman tujuan sebelumnya
        const requestedPath = route.query.redirect;

        const validRedirect = typeof requestedPath === 'string'
            && requestedPath.startsWith('/')
            && !requestedPath.startsWith('//');

        if (validRedirect) {
            const resolved = router.resolve(requestedPath);

            const requiredRole = resolved.matched
                .find(record => record.meta.role)?.meta.role;

            if (!requiredRole || requiredRole === profile.role) {
                await router.replace(requestedPath);
                return;
            }
        }

        await router.replace(destination);

    } catch (e) {
        console.error('Login error:', e);

        error.value = e.code === 'auth/invalid-credential'
            ? 'Email atau password salah.'
            : e.message || 'Terjadi kesalahan saat login.';
    } finally {
        loading.value = false;
    }
}
</script>

<template>
    <main class="auth-page">
        <section class="auth-image">
            <img src="/img/bg-login.jpg" alt="Freshly baked snacks">

            <div class="auth-copy">
                <div>
                    <div class="d-flex align-items-center gap-3">
                        <img src="/img/logo.png" width="44" class="rounded-circle">

                        <div>
                            <h1 class="m-0">Cravely</h1>
                            <span>Crave It, Love It</span>
                        </div>
                    </div>
                </div>

                <div>
                    <div class="pitch">
                        Pre-order your<br>
                        <i>favorite snacks</i><br>
                        in advance.
                    </div>

                    <p>Freshly made for every pre-order period and ready to enjoy.</p>
                </div>
            </div>
        </section>

        <section class="auth-form-wrap">
            <form class="auth-form" @submit.prevent="submit">
                <h2>Welcome back</h2>

                <p class="text-muted">
                    Sign in to manage your pre-orders.
                </p>

                <div v-if="error" class="alert alert-danger">
                    {{ error }}
                </div>

                <label>Email</label>
                <input v-model="email" class="form-control" type="email" required placeholder="Email">

                <label>Password</label>
                <input v-model="password" class="form-control" type="password" required placeholder="Password">

                <button class="btn btn-primary w-100 mt-4" :disabled="loading">
                    {{ loading ? 'Signing in...' : 'Login' }}
                    <i class="bi bi-arrow-right-short"></i>
                </button>

                <p class="text-center mt-3">
                    Don't have an account?
                    <RouterLink to="/register">Register</RouterLink>
                </p>
            </form>
        </section>
    </main>
</template>
