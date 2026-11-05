
import { auth, db, storage } from '../firebase';

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  deleteUser,
} from 'firebase/auth';

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

import {
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage';

// =====================================================
// HELPER
// =====================================================

function getCurrentUser() {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('Silakan login terlebih dahulu.');
  }

  return user;
}

function validateUserId(uid) {
  const user = getCurrentUser();

  if (!uid || user.uid !== uid) {
    throw new Error('Akses data tidak diizinkan.');
  }

  return user;
}

function validateNumber(value, fieldName, min = 0) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < min) {
    throw new Error(`${fieldName} tidak valid.`);
  }

  return number;
}

function calculateDiscountedPrice(price, discount = 0) {
  const validPrice = validateNumber(price, 'Harga');
  const validDiscount = validateNumber(discount, 'Diskon');

  if (validDiscount > 100) {
    throw new Error('Diskon tidak boleh lebih dari 100%.');
  }

  return validPrice * (1 - validDiscount / 100);
}

// =====================================================
// FORMAT RUPIAH
// =====================================================

export const rupiah = (value) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
};

// =====================================================
// AUTHENTICATION & USER
// =====================================================

export async function currentUserProfile(uid) {
  if (!uid) {
    throw new Error('UID pengguna tidak ditemukan.');
  }

  const userRef = doc(db, 'users', uid);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

export async function registerUser(data) {
  if (!data.email || !data.password || !data.fullname || !data.username) {
    throw new Error('Lengkapi semua data wajib terlebih dahulu.');
  }

  let credential = null;

  try {
    credential = await createUserWithEmailAndPassword(
      auth,
      data.email.trim(),
      data.password,
    );

    await setDoc(doc(db, 'users', credential.user.uid), {
      fullname: data.fullname.trim(),
      username: data.username.trim(),
      email: data.email.trim(),
      phoneNumber: data.phoneNumber || '',
      address: data.address || '',

      // Registrasi publik selalu menjadi customer.
      // Admin hanya dibuat secara manual di Firebase.
      role: 'customer',

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return credential.user;
  } catch (error) {
    // Jika pembuatan profil gagal, hapus akun Auth
    // agar tidak meninggalkan akun tanpa dokumen users.
    if (credential?.user) {
      try {
        await deleteUser(credential.user);
      } catch (deleteError) {
        console.error('Gagal membersihkan akun:', deleteError);
      }
    }

    throw error;
  }
}

export async function loginUser(email, password) {
  if (!email || !password) {
    throw new Error('Email dan password wajib diisi.');
  }

  return signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function logoutUser() {
  return signOut(auth);
}

// =====================================================
// PRODUCTS
// =====================================================

export async function getProducts(category = '') {
  const productsRef = collection(db, 'products');

  const productsQuery = category
    ? query(productsRef, where('category', '==', category))
    : query(productsRef);

  const snapshot = await getDocs(productsQuery);

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
}

export async function saveProduct(product, imageFile = null) {
  const user = getCurrentUser();
  const profile = await currentUserProfile(user.uid);

  if (profile?.role !== 'admin') {
    throw new Error('Hanya admin yang dapat mengelola produk.');
  }

  if (!product.name || !product.category) {
    throw new Error('Nama dan kategori produk wajib diisi.');
  }

  const price = validateNumber(product.price, 'Harga');
  const stock = validateNumber(product.stock || 0, 'Stok');
  const discount = validateNumber(product.discount || 0, 'Diskon');

  if (discount > 100) {
    throw new Error('Diskon tidak boleh lebih dari 100%.');
  }

  let image = product.image || '';

  if (imageFile) {
    image = await uploadImage(imageFile, 'products');
  }

  const payload = {
    ...product,
    image,
    price,
    stock,
    discount,
    updatedAt: serverTimestamp(),
  };

  delete payload.id;

  if (product.id) {
    await updateDoc(doc(db, 'products', product.id), payload);
    return product.id;
  }

  const result = await addDoc(collection(db, 'products'), {
    ...payload,
    createdAt: serverTimestamp(),
  });

  return result.id;
}

export async function removeProduct(id) {
  const user = getCurrentUser();
  const profile = await currentUserProfile(user.uid);

  if (profile?.role !== 'admin') {
    throw new Error('Hanya admin yang dapat menghapus produk.');
  }

  if (!id) {
    throw new Error('ID produk tidak ditemukan.');
  }

  return deleteDoc(doc(db, 'products', id));
}

// =====================================================
// IMAGE UPLOAD
// =====================================================

export async function uploadImage(file, folder) {
  getCurrentUser();

  const allowedFolders = ['products', 'payments'];

  if (!allowedFolders.includes(folder)) {
    throw new Error('Folder upload tidak diizinkan.');
  }

  if (!file) {
    throw new Error('File belum dipilih.');
  }

  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
  ];

  if (!allowedTypes.includes(file.type)) {
    throw new Error('Format file tidak didukung.');
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Ukuran file maksimal 5 MB.');
  }

  if (folder === 'products') {
    const user = getCurrentUser();
    const profile = await currentUserProfile(user.uid);

    if (profile?.role !== 'admin') {
      throw new Error('Hanya admin yang dapat mengunggah gambar produk.');
    }

    if (file.type === 'application/pdf') {
      throw new Error('Gambar produk harus berupa gambar.');
    }
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const fileName = `${Date.now()}-${crypto.randomUUID()}-${safeName}`;

  const target = ref(storage, `${folder}/${fileName}`);

  await uploadBytes(target, file, {
    contentType: file.type,
  });

  return getDownloadURL(target);
}

// =====================================================
// CART
// =====================================================

export async function getCart(uid) {
  validateUserId(uid);

  const snapshot = await getDocs(
    collection(db, 'users', uid, 'cart'),
  );

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
}

export async function addToCart(product) {
  const user = getCurrentUser();

  if (!product?.id) {
    throw new Error('Produk tidak ditemukan.');
  }

  // Ambil data produk terbaru dari Firestore.
  // Jangan hanya mengandalkan harga dari halaman frontend.
  const productRef = doc(db, 'products', product.id);
  const productSnapshot = await getDoc(productRef);

  if (!productSnapshot.exists()) {
    throw new Error('Produk sudah tidak tersedia.');
  }

  const latestProduct = productSnapshot.data();

  if (Number(latestProduct.stock || 0) < 1) {
    throw new Error('Stok produk sedang habis.');
  }

  const target = doc(
    db,
    'users',
    user.uid,
    'cart',
    product.id,
  );

  const existing = await getDoc(target);

  const cartDetails = {
    productId: product.id,
    name: latestProduct.name,
    image: latestProduct.image || '',
    category: latestProduct.category || '',
    detail: latestProduct.detail || {},
    price: calculateDiscountedPrice(
      latestProduct.price,
      latestProduct.discount || 0,
    ),
    updatedAt: serverTimestamp(),
  };

  if (existing.exists()) {
    const currentQuantity = Number(existing.data().quantity || 0);

    if (currentQuantity >= 5) {
      throw new Error('Maksimal 5 item untuk setiap produk.');
    }

    return updateDoc(target, {
      ...cartDetails,
      quantity: increment(1),
    });
  }

  return setDoc(target, {
    ...cartDetails,
    quantity: 1,
    createdAt: serverTimestamp(),
  });
}

export async function updateCartItem(uid, id, quantity) {
  validateUserId(uid);

  if (!id) {
    throw new Error('Produk keranjang tidak ditemukan.');
  }

  const validQuantity = Number(quantity);
  const target = doc(db, 'users', uid, 'cart', id);

  if (!Number.isInteger(validQuantity)) {
    throw new Error('Jumlah produk tidak valid.');
  }

  if (validQuantity < 1) {
    return deleteDoc(target);
  }

  if (validQuantity > 5) {
    throw new Error('Maksimal 5 item untuk setiap produk.');
  }

  return updateDoc(target, {
    quantity: validQuantity,
    updatedAt: serverTimestamp(),
  });
}

// =====================================================
// WISHLIST
// =====================================================

export async function toggleWishlist(product) {
  const user = getCurrentUser();

  if (!product?.id) {
    throw new Error('Produk tidak ditemukan.');
  }

  const target = doc(
    db,
    'users',
    user.uid,
    'wishlist',
    product.id,
  );

  const existing = await getDoc(target);

  if (existing.exists()) {
    return deleteDoc(target);
  }

  // Ambil data produk terbaru.
  const productSnapshot = await getDoc(
    doc(db, 'products', product.id),
  );

  if (!productSnapshot.exists()) {
    throw new Error('Produk sudah tidak tersedia.');
  }

  const latestProduct = productSnapshot.data();

  return setDoc(target, {
    productId: product.id,
    name: latestProduct.name,
    image: latestProduct.image || '',
    price: Number(latestProduct.price || 0),
    discount: Number(latestProduct.discount || 0),
    category: latestProduct.category || '',
    createdAt: serverTimestamp(),
  });
}

export async function getWishlist(uid) {
  validateUserId(uid);

  const snapshot = await getDocs(
    collection(db, 'users', uid, 'wishlist'),
  );

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
}

// =====================================================
// ORDERS
// =====================================================


export async function createOrder(data) {
  const user = getCurrentUser();

  const cartItems = await getCart(user.uid);

  if (!cartItems.length) {
    throw new Error('Keranjang masih kosong.');
  }

  // Mendukung nama field dari CheckoutView.
  const fullname = data.fullname || data.customerName || '';
  const phoneNumber = data.phoneNumber || data.phone || '';
  const shippingAddress = data.shippingAddress || '';

  if (!fullname || !phoneNumber || !shippingAddress) {
    throw new Error('Lengkapi informasi pengiriman terlebih dahulu.');
  }

  const verifiedItems = [];

  // Validasi ulang produk dari Firestore.
  for (const item of cartItems) {
    const productId = item.productId || item.id;

    const productSnapshot = await getDoc(
      doc(db, 'products', productId),
    );

    if (!productSnapshot.exists()) {
      throw new Error(`Produk ${item.name} sudah tidak tersedia.`);
    }

    const product = productSnapshot.data();
    const quantity = Number(item.quantity || 0);
    const stock = Number(product.stock || 0);

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 5) {
      throw new Error(`Jumlah produk ${item.name} tidak valid.`);
    }

    if (quantity > stock) {
      throw new Error(`Stok ${item.name} tidak mencukupi.`);
    }

    const price = calculateDiscountedPrice(
      product.price,
      product.discount || 0,
    );

    verifiedItems.push({
      productId,
      name: product.name,
      image: product.image || '',
      category: product.category || '',
      price,
      quantity,
      subtotal: price * quantity,
    });
  }

  const totalAmount = verifiedItems.reduce(
    (total, item) => total + item.subtotal,
    0,
  );

  const orderRef = doc(collection(db, 'orders'));
  const batch = writeBatch(db);

  const orderData = {
    items: verifiedItems,
    totalAmount,
    userId: user.uid,
    orderNumber: `CRV-${Date.now().toString().slice(-8)}`,

    customerName: fullname,
    fullname,
    email: data.email || user.email || '',
    phoneNumber,
    shippingAddress,
    city: data.city || '',
    province: data.province || '',
    postal: data.postal || '',
    customerNote: data.customerNote || '',
    paymentMethod: data.paymentMethod || 'Transfer',

    status: 'Waiting Payment',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  // Membuat pesanan.
  batch.set(orderRef, orderData);

  // Menghapus seluruh isi keranjang secara atomik.
  cartItems.forEach((item) => {
    batch.delete(
      doc(db, 'users', user.uid, 'cart', item.id),
    );
  });

  await batch.commit();

  return orderRef.id;
}


export async function getOrders(uid) {
  validateUserId(uid);

  const snapshot = await getDocs(
    query(
      collection(db, 'orders'),
      where('userId', '==', uid),
    ),
  );

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
}

export async function getAllOrders() {
  const user = getCurrentUser();
  const profile = await currentUserProfile(user.uid);

  if (profile?.role !== 'admin') {
    throw new Error('Hanya admin yang dapat melihat semua pesanan.');
  }

  const snapshot = await getDocs(
    query(
      collection(db, 'orders'),
      orderBy('createdAt', 'desc'),
    ),
  );

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
}

export async function updateOrderStatus(id, status) {
  const user = getCurrentUser();
  const profile = await currentUserProfile(user.uid);

  if (profile?.role !== 'admin') {
    throw new Error('Hanya admin yang dapat mengubah status pesanan.');
  }

  const allowedStatuses = [
    'Waiting Payment',
    'Payment Verification',
    'Confirmed',
    'In Production',
    'Ready for Delivery',
    'Delivered',
    'Completed',
    'Rejected',
  ];

  if (!allowedStatuses.includes(status)) {
    throw new Error('Status pesanan tidak valid.');
  }

  if (!id) {
    throw new Error('ID pesanan tidak ditemukan.');
  }

  return updateDoc(doc(db, 'orders', id), {
    status,
    updatedAt: serverTimestamp(),
  });
}
