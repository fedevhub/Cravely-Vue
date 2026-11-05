<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import {
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';

import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from 'firebase/storage';

import CustomerNav from '../../components/CustomerNav.vue';
import { auth, db, storage } from '../../firebase';

import {
  getOrders,
  rupiah,
} from '../../services/store';

const route = useRoute();

const order = ref(null);
const loadingOrder = ref(true);
const loadError = ref('');

const proofFile = ref(null);
const errorMessage = ref('');
const successMessage = ref('');

const uploading = ref(false);

const isTracking = computed(() =>
  route.path.includes('/tracking/'),
);

const canSubmitPayment = computed(() =>
  ['Waiting Payment', 'Rejected'].includes(order.value?.status),
);

const statuses = [
  'Waiting Payment',
  'Payment Verification',
  'Confirmed',
  'In Production',
  'Ready for Delivery',
  'Delivered',
  'Completed',
];

const currentStatusIndex = computed(() =>
  statuses.indexOf(order.value?.status),
);

// =====================================
// LOAD ORDER
// =====================================

async function loadOrder(id) {
  loadingOrder.value = true;
  loadError.value = '';

  order.value = null;
  proofFile.value = null;

  errorMessage.value = '';
  successMessage.value = '';

  try {
    if (!auth.currentUser) {
      throw new Error('Silakan login terlebih dahulu.');
    }

    if (!id) {
      throw new Error('ID pesanan tidak ditemukan.');
    }

    const orders = await getOrders(auth.currentUser.uid);

    order.value =
      orders.find((item) => item.id === id) || null;

  } catch (error) {
    console.error('Gagal mengambil pesanan:', error);

    loadError.value =
      error instanceof Error
        ? error.message
        : 'Unable to load this order.';
  } finally {
    loadingOrder.value = false;
  }
}

watch(
  () => route.params.id,
  (id) => loadOrder(id),
  { immediate: true },
);

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

// =====================================
// SELECT PAYMENT PROOF
// =====================================

function chooseProof(event) {
  const file = event.target.files?.[0];

  errorMessage.value = '';
  successMessage.value = '';
  proofFile.value = null;

  if (!file) return;

  const validType = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
  ].includes(file.type);

  if (!validType) {
    errorMessage.value =
      'Choose a JPG, PNG, WEBP, or PDF file.';

    event.target.value = '';
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    errorMessage.value =
      'The file must be 5 MB or smaller.';

    event.target.value = '';
    return;
  }

  proofFile.value = file;
}

// =====================================
// SUBMIT PAYMENT PROOF
// =====================================

async function submitProof() {
  if (uploading.value) return;

  if (!auth.currentUser) {
    errorMessage.value = 'Silakan login terlebih dahulu.';
    return;
  }

  if (!proofFile.value || !order.value) {
    errorMessage.value = 'Choose a payment proof first.';
    return;
  }

  if (!canSubmitPayment.value) {
    errorMessage.value =
      'This order is not awaiting a payment proof.';
    return;
  }

  errorMessage.value = '';
  successMessage.value = '';

  uploading.value = true;

  let uploadedFileRef = null;

  try {
    const uid = auth.currentUser.uid;
    const selectedFile = proofFile.value;

    // Upload file ke folder khusus pengguna dan pesanan.
    const safeFileName = selectedFile.name.replace(
      /[^a-zA-Z0-9._-]/g,
      '_',
    );

    const filePath =
      `payments/${uid}/${order.value.id}/` +
      `${crypto.randomUUID()}-${safeFileName}`;

    uploadedFileRef = storageRef(storage, filePath);

    await uploadBytes(uploadedFileRef, selectedFile, {
      contentType: selectedFile.type,
    });

    const paymentProof = await getDownloadURL(uploadedFileRef);

    // Simpan URL bukti pembayaran ke Firestore.
    await updateDoc(doc(db, 'orders', order.value.id), {
      paymentProof,
      status: 'Payment Verification',
      updatedAt: serverTimestamp(),
    });

    order.value = {
      ...order.value,
      paymentProof,
      status: 'Payment Verification',
    };

    proofFile.value = null;

    successMessage.value =
      'Payment proof submitted for verification.';

  } catch (error) {
    console.error('Gagal mengirim bukti pembayaran:', error);

    // Hapus file jika upload berhasil tetapi update Firestore gagal.
    if (uploadedFileRef) {
      try {
        await deleteObject(uploadedFileRef);
      } catch (cleanupError) {
        console.error(
          'Gagal membersihkan file pembayaran:',
          cleanupError,
        );
      }
    }

    errorMessage.value =
      error instanceof Error
        ? error.message
        : 'Unable to submit payment proof.';

  } finally {
    uploading.value = false;
  }
}
</script>

<template>
  <CustomerNav />

  <main v-if="loadingOrder" class="reference-page">
    <div class="empty-reference" aria-live="polite">
      <i class="bi bi-hourglass-split" />
      <h2>Loading your order</h2>
    </div>
  </main>

  <main v-else-if="loadError" class="reference-page">
    <div class="alert alert-danger" role="alert">
      {{ loadError }}
    </div>

    <RouterLink class="reference-button" to="/customer/history">
      Back to order history
    </RouterLink>
  </main>

  <main v-else-if="!order" class="reference-page">
    <div class="empty-reference">
      <i class="bi bi-box-seam" />
      <h2>Order not found</h2>
      <p>
        This order may have been removed or is not available to your account.
      </p>

      <RouterLink class="reference-button" to="/customer/history">
        Back to order history
      </RouterLink>
    </div>
  </main>

  <!-- TRACKING -->
  <main v-else-if="isTracking" class="reference-page tracking-reference">
    <h1>Track Your Order</h1>
    <p class="reference-lead">
      Order details and current production status.
    </p>

    <section class="tracking-search">
      <i class="bi bi-search" />
      <span>{{ order.orderNumber || order.id }}</span>

      <RouterLink to="/customer/history">
        Back to history
      </RouterLink>
    </section>

    <div class="tracking-grid">
      <article class="tracking-detail-card">
        <div class="tracking-dark-head">
          <div>
            <small>Order ID</small>
            <strong>{{ order.orderNumber || order.id }}</strong>
          </div>

          <div>
            <small>Placed</small>
            <strong>{{ formatDate(order.createdAt) }}</strong>
          </div>
        </div>

        <div class="tracking-body">
          <h2>Order Timeline</h2>

          <div class="timeline tracking-timeline">
            <div v-for="(status, index) in statuses" :key="status" :class="[
              'timeline-item',
              {
                done: currentStatusIndex >= index,
                active: currentStatusIndex === index,
              },
            ]">
              <strong>{{ status }}</strong>

              <small>
                {{
                  currentStatusIndex === index
                    ? 'Current status'
                    : currentStatusIndex > index
                      ? 'Completed'
                      : 'Waiting'
                }}
              </small>
            </div>
          </div>

          <div v-if="order.status === 'Rejected'" class="payment-tip">
            Your order or payment was rejected. Please contact Cravely support for clarification.
          </div>

          <div class="tracking-items">
            <h3>Order Items</h3>

            <div v-for="item in order.items || []" :key="item.productId || item.name" class="tracking-item">
              <img :src="item.image || '/img/cookies.jpeg'" :alt="item.name || 'Product'" />

              <span>
                <strong>{{ item.name || 'Product' }}</strong>
                <small>Qty: {{ item.quantity }}</small>
              </span>

              <b>
                {{ rupiah((Number(item.price) || 0) * (Number(item.quantity) || 0)) }}
              </b>
            </div>
          </div>

          <div class="tracking-actions">
            <RouterLink :to="`/customer/payment/${order.id}`">
              <i class="bi bi-receipt" /> View Payment
            </RouterLink>

            <a href="mailto:hello@cravely.id">
              <i class="bi bi-envelope" /> Contact Support
            </a>
          </div>
        </div>
      </article>

      <aside class="reference-summary">
        <h2>Order Summary</h2>

        <div class="summary-line">
          <span>Status</span>
          <b>{{ order.status }}</b>
        </div>

        <div class="summary-line">
          <span>Payment</span>
          <b>{{ order.paymentMethod }}</b>
        </div>

        <div class="summary-line">
          <span>Shipping</span>
          <b>Included</b>
        </div>

        <div class="summary-total">
          <span>Total</span>
          <b>{{ rupiah(order.totalAmount) }}</b>
        </div>

        <div class="delivery-note">
          📦 <strong>Delivery:</strong>
          based on the active pre-order batch.
        </div>
      </aside>
    </div>
  </main>

  <!-- PAYMENT -->
  <main v-else class="reference-page payment-reference">
    <RouterLink class="reference-back" to="/customer/history">
      <i class="bi bi-chevron-left" /> Back to Order History
    </RouterLink>

    <h1>Upload Payment Proof</h1>

    <p class="reference-lead">
      Send your transfer receipt so we can verify your order.
    </p>

    <section class="payment-order-card">
      <div class="payment-order-head">
        <h2>Order Details</h2>
        <span>{{ order.orderNumber || order.id }}</span>
      </div>

      <div class="payment-meta-grid">
        <div>
          <small>Amount to transfer</small>
          <strong>{{ rupiah(order.totalAmount) }}</strong>
        </div>

        <div>
          <small>Payment method</small>
          <strong>{{ order.paymentMethod || 'Not specified' }}</strong>
        </div>
      </div>

      <div class="payment-account">
        <small>Cravely payment account</small>
        <strong>Check your checkout confirmation</strong>
        <span>
          Use the current transfer details provided by Cravely.
        </span>
      </div>

      <p class="payment-warning">
        <i class="bi bi-exclamation-triangle" />
        Transfer the exact amount to avoid verification delays.
      </p>

      <p v-if="order.status === 'Payment Verification'" class="payment-tip">
        Your payment proof is being reviewed.
      </p>

      <a v-if="order.paymentProof" class="payment-proof-link" :href="order.paymentProof" target="_blank"
        rel="noopener noreferrer">
        View submitted payment proof
      </a>
    </section>

    <section class="payment-upload-card">
      <h2>Upload Your Receipt</h2>

      <form class="payment-upload-form" @submit.prevent="submitProof">
        <label class="upload-drop">
          <i class="bi bi-cloud-arrow-up" />

          <strong>
            {{ proofFile?.name || 'Choose your receipt' }}
          </strong>

          <span>PNG, JPG, WEBP, or PDF — max 5 MB</span>

          <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" @change="chooseProof"
            :disabled="uploading || !canSubmitPayment" />
        </label>

        <div class="payment-tip">
          Make sure the amount, account number, and date are clearly visible.
        </div>

        <p v-if="errorMessage" class="alert alert-danger" role="alert">
          {{ errorMessage }}
        </p>

        <p v-if="successMessage" class="alert alert-success" role="status">
          {{ successMessage }}
        </p>

        <button class="reference-button full" type="submit" :disabled="!proofFile || uploading || !canSubmitPayment">
          <i class="bi bi-upload" />
          {{ uploading ? 'Submitting...' : 'Submit Payment Proof' }}
        </button>
      </form>
    </section>
  </main>
</template>
