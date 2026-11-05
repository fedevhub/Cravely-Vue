<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { registerUser } from '../../services/store';
const router = useRouter(),
  form = reactive({
    fullname: '',
    username: '',
    email: '',
    phoneNumber: '',
    address: '',
    password: '',
  }),
  error = ref(''),
  loading = ref(false);
async function submit() {
  try {
    loading.value = true;
    await registerUser(form);
    router.push('/home');
  } catch (e) {
    error.value =
      e.code === 'auth/email-already-in-use'
        ? 'Email sudah terdaftar.'
        : 'Registrasi gagal, periksa kembali data Anda.';
  } finally {
    loading.value = false;
  }
}
</script>
<template>
  <main class="auth-page register-page">
    <section class="auth-image">
      <img src="/img/bg-register.jpg" alt="Cravely snacks" />
      <div class="auth-copy">
        <div class="d-flex align-items-center gap-3">
          <img src="/img/logo.png" width="44" class="rounded-circle" />
          <h1 class="m-0">Cravely</h1>
        </div>
        <div>
          <div class="pitch">Good snacks are<br /><i>worth waiting</i> for.</div>
          <p>Create an account and join the next batch.</p>
        </div>
      </div>
    </section>
    <section class="auth-form-wrap">
      <form class="auth-form" @submit.prevent="submit">
        <h2>Create account</h2>
        <p class="text-muted">Start your Cravely pre-order journey.</p>
        <div v-if="error" class="alert alert-danger">{{ error }}</div>
        <label>Full name</label
        ><input v-model="form.fullname" class="form-control" required /><label>Username</label
        ><input v-model="form.username" class="form-control" required /><label>Email</label
        ><input v-model="form.email" type="email" class="form-control" required /><label
          >Phone number</label
        ><input v-model="form.phoneNumber" class="form-control" /><label>Address</label
        ><textarea v-model="form.address" class="form-control" /><label>Password</label
        ><input
          v-model="form.password"
          type="password"
          minlength="6"
          class="form-control"
          required
        /><button class="btn btn-primary w-100 mt-4" :disabled="loading">
          {{ loading ? 'Creating...' : 'Register' }}
        </button>
        <p class="text-center mt-3">
          Already have an account? <RouterLink to="/login">Login</RouterLink>
        </p>
      </form>
    </section>
  </main>
</template>
