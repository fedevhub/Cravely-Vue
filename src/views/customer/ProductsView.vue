<script setup>
import { onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { auth } from '../../firebase';
import CustomerNav from '../../components/CustomerNav.vue';
import ProductGrid from '../../components/ProductGrid.vue';
import { getProducts, getWishlist, rupiah, toggleWishlist } from '../../services/store';

const props = defineProps({ wishlist: Boolean });
const route = useRoute();
const products = ref([]);

async function load() {
  if (props.wishlist) {
    products.value = await getWishlist(auth.currentUser.uid);
    return;
  }
  products.value = await getProducts(route.query.category || '');
}

async function removeFromWishlist(product) {
  await toggleWishlist(product);
  await load();
}

onMounted(load);
watch(() => route.query.category, load);
watch(() => props.wishlist, load);
</script>

<template>
  <CustomerNav />
  <main v-if="wishlist" class="reference-page wishlist-reference">
    <h1>
      My Wishlist <small>({{ products.length }} items)</small>
    </h1>
    <div v-if="products.length" class="row g-4 mt-3">
      <div v-for="product in products" :key="product.id" class="col-md-4">
        <article class="customer-card">
          <img
            class="w-100 rounded mb-3"
            :src="product.image || '/img/cookies.jpeg'"
            :alt="product.name"
          />
          <h2>{{ product.name }}</h2>
          <p class="customer-price">
            <span v-if="product.discount" class="price-old">{{ rupiah(product.price) }}</span>
            {{ rupiah(product.price * (1 - (product.discount || 0) / 100)) }}
            <span v-if="product.discount" class="badge-discount">-{{ product.discount }}%</span>
          </p>
          <div class="d-flex gap-2">
            <RouterLink class="customer-button" :to="`/customer/detailProducts/${product.id}`">
              View
            </RouterLink>
            <button
              class="customer-button outline"
              type="button"
              @click="removeFromWishlist(product)"
            >
              Remove
            </button>
          </div>
        </article>
      </div>
    </div>
    <div v-else class="empty-reference">
      <i class="bi bi-heart" />
      <h2>Your wishlist is empty</h2>
      <p>Save your favorite snacks and they will show up here.</p>
      <RouterLink class="reference-button" to="/customer/products">Browse Products</RouterLink>
    </div>
  </main>
  <main v-else>
    <ProductGrid :products="products" :category="route.query.category || 'all'" />
  </main>
</template>
