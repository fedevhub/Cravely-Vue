<script setup>
import { computed, ref, watch } from 'vue';
import { addToCart, rupiah, toggleWishlist } from '../services/store';
const props = defineProps({
  products: { type: Array, default: () => [] },
  category: { type: String, default: 'all' },
});
const term = ref('');
const selected = ref(props.category);
const message = ref('');
watch(
  () => props.category,
  (category) => (selected.value = category),
);
const filtered = computed(() =>
  props.products.filter(
    (p) =>
      (selected.value === 'all' || p.category === selected.value) &&
      p.name.toLowerCase().includes(term.value.toLowerCase()),
  ),
);
async function add(product) {
  try {
    await addToCart(product);
    message.value = `${product.name} ditambahkan ke cart.`;
  } catch {
    message.value = 'Silakan login untuk menambahkan produk.';
  }
}
</script>
<template>
  <section class="products-section">
    <div class="container">
      <div class="section-heading text-center mb-4">
        <h2>Best Sellers</h2>
        <p>Freshly baked favorites loved by our customers.</p>
      </div>
      <div class="filter-search-row">
        <div class="filter-tabs">
          <button
            v-for="item in ['all', 'sweet', 'savory']"
            :key="item"
            class="filter-btn"
            :class="{ active: selected === item }"
            @click="selected = item"
          >
            {{
              item === 'all' ? 'All Products' : `${item[0].toUpperCase() + item.slice(1)} Corner`
            }}
          </button>
        </div>
        <div class="search-box">
          <i class="bi bi-search search-icon" /><input
            v-model="term"
            class="search-input"
            placeholder="Search products..."
          />
        </div>
      </div>
      <p v-if="message" class="text-center text-success">{{ message }}</p>
      <div class="row g-4">
        <div v-for="product in filtered" :key="product.id" class="col-xl-3 col-lg-4 col-md-6">
          <div class="product-card">
            <div class="card-image">
              <img
                :src="product.image || '/img/cookies.jpeg'"
                :alt="product.name"
                class="card-img-top"
              />
              <div class="badge-left">
                <span
                  class="badge-status"
                  :class="product.isActive === 'ready stok' ? 'badge-ready' : 'badge-preorder'"
                  >{{ product.isActive === 'ready stok' ? 'Ready Stock' : 'Pre Order' }}</span
                ><span v-if="product.isBestSeller" class="badge-best">Best Seller</span>
              </div>
              <button class="card-wishlist-btn" @click="toggleWishlist(product)">
                <i class="bi bi-heart" />
              </button>
              <div class="badge-right">
                <span class="badge-category">{{ product.category }}</span>
              </div>
            </div>
            <div class="card-body">
              <h3 class="card-title">{{ product.name }}</h3>
              <p class="card-description">{{ product.description }}</p>
              <div class="card-footer-custom">
                <div class="price">
                  <span class="currency">Rp</span>
                  {{
                    rupiah(product.price * (1 - (product.discount || 0) / 100)).replace('Rp', '')
                  }}
                </div>
                <button class="cart-button" @click="add(product)">
                  <i class="bi bi-cart-plus" /><span>Add to cart</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        <div v-if="!filtered.length" class="col-12 text-center py-5">
          Belum ada menu yang sesuai.
        </div>
      </div>
    </div>
  </section>
</template>
