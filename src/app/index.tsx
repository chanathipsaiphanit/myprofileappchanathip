import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const API = 'http://119.59.102.161:3093/api';
const FALLBACK =
  'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9';

type Page = 'home' | 'login' | 'register' | 'cart' | 'orders' | 'admin';
type Tab = 'products' | 'orders';

type Product = {
  id: number | string;
  name: string;
  brand: string;
  description?: string;
  price: number | string;
  imageUrl?: string;
  stock: number;
};

type CartItem = Product & {
  quantity: number;
};

type Order = {
  id: number;
  username: string;
  total_price: number | string;
  status: string;
  created_at?: string;
  items?: any[];
};

const empty = {
  name: '',
  brand: '',
  description: '',
  price: '',
  imageUrl: '',
  stock: '0',
};

export default function HomeScreen() {
  // =========================================================
  // STATE
  // =========================================================

  const [page, setPage] = useState<Page>('home');
  const [tab, setTab] = useState<Tab>('products');
  const [priceSort, setPriceSort] = useState<'none' | 'low' | 'high'>('none');

  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);

  const [orders, setOrders] = useState<Order[]>([]);
  const [adminOrders, setAdminOrders] = useState<Order[]>([]);

  const [search, setSearch] = useState('');
  const [token, setToken] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [regUser, setRegUser] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regConfirm, setRegConfirm] = useState('');

  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<number | string | null>(null);

  const [modal, setModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const admin = username.trim().toLowerCase() === 'admin';

  // =========================================================
  // HELPERS
  // =========================================================

  const money = (v: number | string) =>
    Number(v || 0).toLocaleString('th-TH');

  const statusLabel = (status: string) => {
    switch (status) {
      case 'paid': return 'ชำระเงินแล้ว';
      case 'shipping': return 'กำลังจัดส่ง';
      case 'completed': return 'สำเร็จ';
      case 'cancelled': return 'ยกเลิก';
      default: return 'รอดำเนินการ';
    }
  };

  const message = (title: string, text: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n${text}`);
    } else {
      Alert.alert(title, text);
    }
  };

  // =========================================================
  // API
  // =========================================================

  const api = async (
    path: string,
    opt: RequestInit = {}
  ) => {
    const headers: Record<string, string> = {
      ...(opt.body
        ? {
            'Content-Type': 'application/json',
          }
        : {}),
      ...(token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {}),
    };

    Object.assign(
      headers,
      (opt.headers || {}) as Record<string, string>
    );

    const response = await fetch(API + path, {
      ...opt,
      headers,
    });

    const text = await response.text();

    let data: any = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {
        message: text,
      };
    }

    if (!response.ok) {
      throw new Error(
        data.error ||
          data.message ||
          `HTTP ${response.status}`
      );
    }

    return data;
  };

  // =========================================================
  // NORMALIZE PRODUCT
  // =========================================================

  const normalize = (p: any): Product => ({
    id: p.id,
    name: p.name ?? p.NAME ?? '',
    brand: p.brand ?? '',
    description: p.description ?? '',
    price: Number(p.price ?? 0),
    imageUrl: p.imageUrl || FALLBACK,
    stock: Number(p.stock ?? 0),
  });

  // =========================================================
  // LOAD PRODUCTS
  // =========================================================

  const loadProducts = async () => {
    setLoading(true);

    try {
      const data = await api('/products');

      const list = Array.isArray(data)
        ? data
        : data.products || [];

      setProducts(list.map(normalize));
    } catch (error: any) {
      setProducts([]);
      message(
        'สินค้า',
        error.message || 'โหลดสินค้าไม่ได้'
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // LOAD ORDERS
  // =========================================================

  const loadOrders = async () => {
    if (!token) return;

    try {
      const data = await api(
        `/orders/my?username=${encodeURIComponent(
          username
        )}`
      );

      setOrders(
        Array.isArray(data)
          ? data
          : data.orders || []
      );
    } catch (error: any) {
      message(
        'คำสั่งซื้อ',
        error.message || 'โหลดคำสั่งซื้อไม่ได้'
      );
    }
  };

  // =========================================================
  // ADMIN ORDERS
  // =========================================================

  const loadAdminOrders = async () => {
    try {
      const data = await api('/orders');

      setAdminOrders(
        Array.isArray(data)
          ? data
          : data.orders || []
      );
    } catch (error: any) {
      message(
        'หลังบ้าน',
        error.message || 'โหลดคำสั่งซื้อไม่ได้'
      );
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  // =========================================================
  // LOGIN
  // =========================================================

  const login = async () => {
    if (!username.trim() || !password) {
      message(
        'แจ้งเตือน',
        'กรุณากรอก Username และ Password'
      );
      return;
    }

    setBusy(true);

    try {
      const data = await api('/login', {
        method: 'POST',
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      setToken(data.token || '');
      setUsername(
        data.username || username.trim()
      );
      setPassword('');

      setPage('home');

      message(
        'สำเร็จ',
        'เข้าสู่ระบบเรียบร้อย'
      );
    } catch (error: any) {
      message(
        'เข้าสู่ระบบไม่สำเร็จ',
        error.message || 'Username หรือ Password ไม่ถูกต้อง'
      );
    } finally {
      setBusy(false);
    }
  };

  // =========================================================
  // REGISTER
  // =========================================================

  const register = async () => {
    if (
      !regUser.trim() ||
      !regPass ||
      regPass !== regConfirm
    ) {
      message(
        'แจ้งเตือน',
        'กรอกข้อมูลให้ครบ และรหัสผ่านต้องตรงกัน'
      );
      return;
    }

    setBusy(true);

    try {
      await api('/register', {
        method: 'POST',
        body: JSON.stringify({
          username: regUser.trim(),
          password: regPass,
        }),
      });

      setUsername(regUser.trim());
      setPassword(regPass);

      setRegUser('');
      setRegPass('');
      setRegConfirm('');

      setPage('login');

      message(
        'สำเร็จ',
        'สมัครสมาชิกเรียบร้อยแล้ว'
      );
    } catch (error: any) {
      message(
        'สมัครไม่สำเร็จ',
        error.message || 'สมัครสมาชิกไม่ได้'
      );
    } finally {
      setBusy(false);
    }
  };

  // =========================================================
  // LOGOUT
  // =========================================================

  const logout = () => {
    setToken('');
    setPassword('');
    setOrders([]);
    setPage('home');
  };

  // =========================================================
  // CART
  // =========================================================

  /*
   * เพิ่มสินค้า 1 ชิ้น
   *
   * สำคัญ:
   * เราจะเพิ่มเฉพาะสินค้าที่กดเท่านั้น
   * ไม่เอา products ทั้งหมดมาใส่ cart
   */
  const add = (product: Product) => {
    const stock = Number(product.stock) || 0;

    if (stock <= 0) {
      message(
        'สินค้าหมด',
        `${product.name} ไม่มี Stock เหลือแล้ว`
      );
      return;
    }

    setCart(currentCart => {
      const existing = currentCart.find(
        item =>
          String(item.id) ===
          String(product.id)
      );

      // ยังไม่มีสินค้าในตะกร้า
      if (!existing) {
        return [
          ...currentCart,
          {
            ...product,
            quantity: 1,
          },
        ];
      }

      // จำนวนถึง Stock แล้ว
      if (existing.quantity >= stock) {
        message(
          'Stock ไม่เพียงพอ',
          `${product.name} มีทั้งหมด ${stock} ชิ้น`
        );

        return currentCart;
      }

      // เพิ่มเฉพาะสินค้านี้
      return currentCart.map(item =>
        String(item.id) ===
        String(product.id)
          ? {
              ...item,
              quantity: item.quantity + 1,
            }
          : item
      );
    });
  };

  /*
   * เปลี่ยนจำนวนสินค้า
   *
   * delta = +1 เพิ่ม
   * delta = -1 ลด
   */
  const changeQuantity = (
    id: Product['id'],
    delta: number
  ) => {
    setCart(currentCart => {
      return currentCart
        .map(item => {
          if (
            String(item.id) !==
            String(id)
          ) {
            return item;
          }

          const newQuantity = Math.max(
            0,
            Math.min(
              Number(item.stock),
              item.quantity + delta
            )
          );

          return {
            ...item,
            quantity: newQuantity,
          };
        })
        .filter(item => item.quantity > 0);
    });
  };

  /*
   * ลบสินค้าออกจากตะกร้าทั้งรายการ
   */
  const removeFromCart = (
    id: Product['id']
  ) => {
    setCart(currentCart =>
      currentCart.filter(
        item =>
          String(item.id) !==
          String(id)
      )
    );
  };

  /*
   * จำนวนสินค้าทั้งหมดในตะกร้า
   */
  const cartCount = cart.reduce(
    (total, item) =>
      total + item.quantity,
    0
  );

  /*
   * ราคารวม
   */
  const cartTotal = cart.reduce(
    (total, item) =>
      total +
      Number(item.price) *
        item.quantity,
    0
  );

  // =========================================================
  // CHECKOUT
  // =========================================================

  const checkout = async () => {
    if (!token) {
      setPage('login');

      message(
        'กรุณาล็อกอิน',
        'เข้าสู่ระบบก่อนสั่งซื้อ'
      );

      return;
    }

    if (!cart.length) {
      message(
        'ตะกร้าว่าง',
        'กรุณาเลือกสินค้าก่อนสั่งซื้อ'
      );

      return;
    }

    setBusy(true);

    try {
      const data = await api('/orders', {
        method: 'POST',
        body: JSON.stringify({
          username,
          items: cart.map(item => ({
            product_id: Number(item.id),
            quantity: item.quantity,
          })),
        }),
      });

      setCart([]);

      await loadProducts();
      await loadOrders();

      setPage('orders');

      message(
        'สั่งซื้อสำเร็จ',
        `สร้างคำสั่งซื้อ #${
          data.order_id ?? ''
        } เรียบร้อยแล้ว`
      );
    } catch (error: any) {
      message(
        'สั่งซื้อไม่สำเร็จ',
        error.message || 'เกิดข้อผิดพลาด'
      );
    } finally {
      setBusy(false);
    }
  };

  // =========================================================
  // ADMIN - ORDER STATUS
  // =========================================================

  const changeStatus = async (
    id: number,
    status: string
  ) => {
    try {
      await api(
        `/orders/${id}/status`,
        {
          method: 'PUT',
          body: JSON.stringify({
            status,
          }),
        }
      );

      await loadAdminOrders();
    } catch (error: any) {
      message(
        'อัปเดตไม่สำเร็จ',
        error.message || 'เปลี่ยนสถานะไม่ได้'
      );
    }
  };

  // =========================================================
  // ADMIN - SAVE PRODUCT
  // =========================================================

  const save = async () => {
    if (
      !form.name.trim() ||
      !form.price
    ) {
      message(
        'แจ้งเตือน',
        'กรุณากรอกชื่อสินค้าและราคา'
      );

      return;
    }

    setBusy(true);

    try {
      const isEdit =
        editingId !== null;

      await api(
        isEdit
          ? `/products/${editingId}`
          : '/products',
        {
          method: isEdit
            ? 'PUT'
            : 'POST',

          body: JSON.stringify({
            ...form,
            price: Number(form.price),
            stock: Number(form.stock),
            imageUrl:
              form.imageUrl ||
              FALLBACK,
          }),
        }
      );

      setModal(false);

      setForm(empty);
      setEditingId(null);

      await loadProducts();

      message(
        'สำเร็จ',
        isEdit
          ? 'แก้ไขสินค้าเรียบร้อย'
          : 'เพิ่มสินค้าเรียบร้อย'
      );
    } catch (error: any) {
      message(
        'บันทึกไม่สำเร็จ',
        error.message || 'ไม่สามารถบันทึกสินค้าได้'
      );
    } finally {
      setBusy(false);
    }
  };

  // =========================================================
  // ADMIN - DELETE PRODUCT
  // =========================================================

  const remove = async (
    id: Product['id']
  ) => {
    try {
      await api(
        `/products/${id}`,
        {
          method: 'DELETE',
        }
      );

      await loadProducts();

      // ถ้าสินค้าที่ลบอยู่ในตะกร้า
      // เอาออกจากตะกร้าด้วย
      setCart(currentCart =>
        currentCart.filter(
          item =>
            String(item.id) !==
            String(id)
        )
      );

      message(
        'สำเร็จ',
        'ลบสินค้าเรียบร้อย'
      );
    } catch (error: any) {
      message(
        'ลบไม่ได้',
        error.message || 'ไม่สามารถลบสินค้าได้'
      );
    }
  };

  // =========================================================
  // SEARCH
  // =========================================================

  const filtered = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    let list = keyword
      ? products.filter(product =>
          `${product.name} ${product.brand} ${product.description || ''}`
            .toLowerCase()
            .includes(keyword)
        )
      : [...products];

    if (priceSort === 'low') {
      list.sort((a, b) => Number(a.price) - Number(b.price));
    } else if (priceSort === 'high') {
      list.sort((a, b) => Number(b.price) - Number(a.price));
    }

    return list;
  }, [products, search, priceSort]);

  // =========================================================
  // NAV
  // =========================================================

  const nav = (
    text: string,
    fn: () => void
  ) => (
    <Pressable
      style={s.nav}
      onPress={fn}
    >
      <Text style={s.navText}>
        {text}
      </Text>
    </Pressable>
  );

  // =========================================================
  // UI
  // =========================================================

  return (
    <SafeAreaView style={s.screen}>
      {/* =====================================================
          HEADER
      ====================================================== */}

      <View style={s.header}>
        <Pressable
          onPress={() =>
            setPage('home')
          }
        >
          <Text style={s.logo}>
            Noon
            <Text style={s.logo2}>
              Mobile
            </Text>
          </Text>
        </Pressable>

        <View style={s.navrow}>
          {nav(
            `🛒 ${cartCount}`,
            () => setPage('cart')
          )}

          {token ? (
            nav('📦', () => {
              loadOrders();
              setPage('orders');
            })
          ) : null}

          {token && admin ? (
            nav('⚙ Admin', () => {
              setPage('admin');
              loadAdminOrders();
            })
          ) : null}

          {token ? (
            nav('ออก', logout)
          ) : (
            nav('Login', () => setPage('login'))
          )}
        </View>
      </View>

      {/* =====================================================
          CONTENT
      ====================================================== */}

      <ScrollView
        contentContainerStyle={s.content}
      >
        {/* ===================================================
            HOME
        ==================================================== */}

        {page === 'home' && (
          <>
            <View style={s.hero}>
              <Text style={s.kicker}>
                NOONMOBILE • SMARTPHONE STORE
              </Text>

              <Text style={s.heroTitle}>
                สมาร์ตโฟนที่ใช่
                {'\n'}
                สำหรับทุกวัน
              </Text>

              <Text style={s.muted}>
                รวมมือถือและอุปกรณ์ไอที • ราคาชัดเจน • สั่งซื้อออนไลน์
              </Text>

              <Input
                value={search}
                onChangeText={setSearch}
                placeholder="ค้นหาสินค้า หรือแบรนด์..."
              />
            </View>

            <View style={s.shopToolbar}>
              <View>
                <Text style={s.shopTitle}>สินค้า</Text>
                <Text style={s.shopSubtitle}>{filtered.length} รายการ</Text>
              </View>

              <View style={s.priceSortRow}>
                <Text style={s.sortLabel}>ราคา</Text>
                <Pressable
                  style={[s.sortButton, priceSort === 'low' && s.sortButtonActive]}
                  onPress={() => setPriceSort(priceSort === 'low' ? 'none' : 'low')}
                >
                  <Text style={[s.sortButtonText, priceSort === 'low' && s.sortButtonTextActive]}>LOW → HIGH</Text>
                </Pressable>
                <Pressable
                  style={[s.sortButton, priceSort === 'high' && s.sortButtonActive]}
                  onPress={() => setPriceSort(priceSort === 'high' ? 'none' : 'high')}
                >
                  <Text style={[s.sortButtonText, priceSort === 'high' && s.sortButtonTextActive]}>HIGH → LOW</Text>
                </Pressable>
              </View>
            </View>

            {loading ? (
              <ActivityIndicator
                size="large"
                color="#67E8F9"
              />
            ) : (
              <View style={s.grid}>
                {filtered.map(product => (
                  <View
                    style={s.card}
                    key={String(
                      product.id
                    )}
                  >
                    <Image
                      source={{
                        uri:
                          product.imageUrl ||
                          FALLBACK,
                      }}
                      style={s.image}
                    />

                    <View
                      style={s.cardbody}
                    >
                      <Text
                        style={s.brand}
                      >
                        {product.brand}
                      </Text>

                      <Text
                        style={s.name}
                      >
                        {product.name}
                      </Text>

                      {!!product.description && (
                        <Text
                          style={s.productDescription}
                          numberOfLines={2}
                        >
                          {product.description}
                        </Text>
                      )}

                      <Text
                        style={s.price}
                      >
                        ฿
                        {money(
                          product.price
                        )}
                      </Text>

                      <Text
                        style={s.stock}
                      >
                        เหลือ{' '}
                        {product.stock}{' '}
                        ชิ้น
                      </Text>

                      <Pressable
                        style={[
                          s.smallPrimary,
                          product.stock <=
                            0 &&
                            s.disabled,
                        ]}
                        disabled={
                          product.stock <=
                          0
                        }
                        onPress={() =>
                          add(product)
                        }
                      >
                        <Text
                          style={
                            s.smallText
                          }
                        >
                          {product.stock <=
                          0
                            ? 'สินค้าหมด'
                            : '+ เพิ่มลงตะกร้า'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* ===================================================
            LOGIN
        ==================================================== */}

        {page === 'login' && (
          <Auth
            user={username}
            pass={password}
            confirm=""
            setUser={setUsername}
            setPass={setPassword}
            setConfirm={() => {}}
            busy={busy}
            submit={login}
            switchPage={() =>
              setPage('register')
            }
          />
        )}

        {/* ===================================================
            REGISTER
        ==================================================== */}

        {page === 'register' && (
          <Auth
            reg
            user={regUser}
            pass={regPass}
            confirm={regConfirm}
            setUser={setRegUser}
            setPass={setRegPass}
            setConfirm={setRegConfirm}
            busy={busy}
            submit={register}
            switchPage={() =>
              setPage('login')
            }
          />
        )}

        {/* ===================================================
            CART
        ==================================================== */}

        {page === 'cart' && (
          <>
            <Text style={s.title}>
              🛒 ตะกร้าสินค้า
            </Text>

            {/* จำนวนสินค้าในตะกร้า */}
            <Text style={s.cartSummary}>
              มีสินค้า {cartCount} ชิ้น
            </Text>

            {/* ตะกร้าว่าง */}
            {!cart.length && (
              <View
                style={s.emptyCart}
              >
                <Text
                  style={s.emptyIcon}
                >
                  🛒
                </Text>

                <Text
                  style={s.emptyTitle}
                >
                  ตะกร้ายังว่าง
                </Text>

                <Text
                  style={s.muted}
                >
                  กรุณาเลือกสินค้าจากหน้าร้าน
                </Text>

                <Pressable
                  style={s.primary}
                  onPress={() =>
                    setPage('home')
                  }
                >
                  <Text
                    style={
                      s.primaryText
                    }
                  >
                    เลือกซื้อสินค้า
                  </Text>
                </Pressable>
              </View>
            )}

            {/* =================================================
                CART ITEMS

                สำคัญ:
                ใช้ cart.map()
                ไม่ใช่ products.map()
            ================================================== */}

            {cart.map(item => (
              <View
                style={s.cartItem}
                key={String(item.id)}
              >
                {/* รูปสินค้า */}
                <Image
                  source={{
                    uri:
                      item.imageUrl ||
                      FALLBACK,
                  }}
                  style={s.cartImage}
                />

                {/* ข้อมูลสินค้า */}
                <View
                  style={s.cartInfo}
                >
                  <Text
                    style={s.cartName}
                  >
                    {item.name}
                  </Text>

                  <Text
                    style={s.cartBrand}
                  >
                    {item.brand}
                  </Text>

                  <Text
                    style={s.cartPrice}
                  >
                    ฿
                    {money(
                      item.price
                    )}
                  </Text>

                  <Text
                    style={s.cartStock}
                  >
                    Stock เหลือ{' '}
                    {item.stock} ชิ้น
                  </Text>

                  {/* ปุ่มจำนวน */}
                  <View
                    style={
                      s.quantityRow
                    }
                  >
                    {/* ลด */}
                    <Pressable
                      style={[
                        s.quantityButton,
                        item.quantity <=
                          1 &&
                          s.quantityButtonLast,
                      ]}
                      onPress={() =>
                        changeQuantity(
                          item.id,
                          -1
                        )
                      }
                    >
                      <Text
                        style={
                          s.quantityButtonText
                        }
                      >
                        −
                      </Text>
                    </Pressable>

                    {/* จำนวน */}
                    <View
                      style={
                        s.quantityBox
                      }
                    >
                      <Text
                        style={
                          s.quantityNumber
                        }
                      >
                        {item.quantity}
                      </Text>
                    </View>

                    {/* เพิ่ม */}
                    <Pressable
                      style={[
                        s.quantityButton,
                        item.quantity >=
                          item.stock &&
                          s.quantityButtonDisabled,
                      ]}
                      disabled={
                        item.quantity >=
                        item.stock
                      }
                      onPress={() =>
                        changeQuantity(
                          item.id,
                          1
                        )
                      }
                    >
                      <Text
                        style={
                          s.quantityButtonText
                        }
                      >
                        +
                      </Text>
                    </Pressable>

                    {/* ลบทั้งหมด */}
                    <Pressable
                      style={
                        s.removeButton
                      }
                      onPress={() =>
                        removeFromCart(
                          item.id
                        )
                      }
                    >
                      <Text
                        style={
                          s.removeText
                        }
                      >
                        ลบ
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {/* ราคารวมสินค้านี้ */}
                <View
                  style={
                    s.itemTotalBox
                  }
                >
                  <Text
                    style={
                      s.itemTotal
                    }
                  >
                    ฿
                    {money(
                      Number(
                        item.price
                      ) *
                        item.quantity
                    )}
                  </Text>
                </View>
              </View>
            ))}

            {/* สรุปยอด */}
            {cart.length > 0 && (
              <View
                style={s.checkoutBox}
              >
                <View
                  style={
                    s.totalRow
                  }
                >
                  <Text
                    style={
                      s.totalLabel
                    }
                  >
                    จำนวนสินค้า
                  </Text>

                  <Text
                    style={
                      s.totalValue
                    }
                  >
                    {cartCount} ชิ้น
                  </Text>
                </View>

                <View
                  style={
                    s.totalRow
                  }
                >
                  <Text
                    style={
                      s.totalLabel
                    }
                  >
                    รวมทั้งหมด
                  </Text>

                  <Text
                    style={
                      s.totalPrice
                    }
                  >
                    ฿{money(cartTotal)}
                  </Text>
                </View>

                <Pressable
                  style={[
                    s.primary,
                    busy &&
                      s.disabled,
                  ]}
                  disabled={busy}
                  onPress={checkout}
                >
                  {busy ? (
                    <ActivityIndicator
                      color="#07111F"
                    />
                  ) : (
                    <Text
                      style={
                        s.primaryText
                      }
                    >
                      ยืนยันการสั่งซื้อ
                    </Text>
                  )}
                </Pressable>
              </View>
            )}
          </>
        )}

        {/* ===================================================
            ORDERS
        ==================================================== */}

        {page === 'orders' && (
          <>
            <View style={s.sectionHeader}>
              <View>
                <Text style={s.kicker}>MY ACCOUNT</Text>
                <Text style={s.title}>📦 ประวัติการสั่งซื้อ</Text>
              </View>
              <View style={s.orderCountBadge}>
                <Text style={s.orderCountText}>{orders.length} ออเดอร์</Text>
              </View>
            </View>

            {!orders.length && (
              <View style={s.emptyOrder}>
                <Text style={s.emptyIcon}>📦</Text>
                <Text style={s.emptyTitle}>ยังไม่มีคำสั่งซื้อ</Text>
                <Text style={s.muted}>เลือกสมาร์ตโฟนที่ชอบ แล้วสั่งซื้อได้เลย</Text>
                <Pressable style={s.primary} onPress={() => setPage('home')}>
                  <Text style={s.primaryText}>เลือกซื้อสินค้า</Text>
                </Pressable>
              </View>
            )}

            {orders.map(order => (
              <View style={s.orderCard} key={order.id}>
                <View style={s.orderTop}>
                  <View>
                    <Text style={s.orderNumber}>Order #{order.id}</Text>
                    <Text style={s.orderDate}>
                      {order.created_at ? new Date(order.created_at).toLocaleString('th-TH') : 'วันที่ไม่ระบุ'}
                    </Text>
                  </View>
                  <View style={[s.statusBadge, s[`status_${order.status}` as keyof typeof s] as any]}>
                    <Text style={s.statusText}>{statusLabel(order.status)}</Text>
                  </View>
                </View>

                <View style={s.orderDivider} />
                <Text style={s.orderItemsTitle}>รายการสินค้า</Text>

                {Array.isArray(order.items) && order.items.length > 0 ? (
                  order.items.map((item: any, index: number) => (
                    <View style={s.orderItemRow} key={item.id ?? `${order.id}-${index}`}>
                      <View style={s.orderItemIcon}>
                        <Text>📱</Text>
                      </View>
                      <View style={s.orderItemInfo}>
                        <Text style={s.orderItemName}>{item.product_name || 'สินค้า'}</Text>
                        <Text style={s.orderItemMeta}>
                          ฿{money(item.price)} × {item.quantity} ชิ้น
                        </Text>
                      </View>
                      <Text style={s.orderItemSubtotal}>฿{money(item.subtotal)}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={s.muted}>ไม่พบรายละเอียดสินค้าในรายการนี้</Text>
                )}

                <View style={s.orderTotalRow}>
                  <Text style={s.orderTotalLabel}>ยอดรวม</Text>
                  <Text style={s.orderTotalPrice}>฿{money(order.total_price)}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* ===================================================
            ADMIN
        ==================================================== */}

        {page === 'admin' && (
          <>
            <Text
              style={s.kicker}
            >
              CONTROL CENTER
            </Text>

            <Text style={s.title}>
              ⚡ ADMIN
            </Text>

            {/* Tabs */}
            <View style={s.tabs}>
              {(['products', 'orders'] as Tab[]).map(t => (
                <Pressable
                  key={t}
                  style={[
                    s.tab,
                    tab === t &&
                      s.active,
                  ]}
                  onPress={() =>
                    setTab(t)
                  }
                >
                  <Text
                    style={
                      s.tabtext
                    }
                  >
                    {t === 'products' ? 'สินค้า' : 'คำสั่งซื้อ'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* ADMIN PRODUCTS */}
            {tab === 'products' && (
              <>
                <Pressable
                  style={s.primary}
                  onPress={() => {
                    setForm(empty);
                    setEditingId(null);
                    setModal(true);
                  }}
                >
                  <Text
                    style={
                      s.primaryText
                    }
                  >
                    ＋ เพิ่มสินค้า
                  </Text>
                </Pressable>

                {products.map(
                  product => (
                    <View
                      style={s.box}
                      key={String(
                        product.id
                      )}
                    >
                      <Text
                        style={
                          s.name
                        }
                      >
                        {product.name}
                      </Text>

                      <View style={s.adminProductInfo}>
                        <Text style={s.adminProductBrand}>{product.brand}</Text>
                        <Text style={s.adminProductPrice}>฿{money(product.price)}</Text>
                        <Text style={s.adminProductStock}>Stock {product.stock} ชิ้น</Text>
                      </View>
                      {!!product.description && (
                        <Text style={s.adminDescription}>
                          {product.description}
                        </Text>
                      )}

                      <View
                        style={
                          s.actions
                        }
                      >
                        <Pressable
                          style={
                            s.smallBtn
                          }
                          onPress={() => {
                            setForm({
                              name:
                                product.name,
                              brand:
                                product.brand,
                              description:
                                product.description ||
                                '',
                              price:
                                String(
                                  product.price
                                ),
                              imageUrl:
                                product.imageUrl ||
                                '',
                              stock:
                                String(
                                  product.stock
                                ),
                            });

                            setEditingId(
                              product.id
                            );

                            setModal(
                              true
                            );
                          }}
                        >
                          <Text>
                            แก้ไข
                          </Text>
                        </Pressable>

                        <Pressable
                          style={
                            s.danger
                          }
                          onPress={() =>
                            remove(
                              product.id
                            )
                          }
                        >
                          <Text>
                            ลบ
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  )
                )}
              </>
            )}

            {/* ADMIN ORDERS */}
            {tab === 'orders' && (
              <>
                <View style={s.sectionHeader}>
                  <View>
                    <Text style={s.kicker}>ORDER MANAGEMENT</Text>
                    <Text style={s.adminSectionTitle}>จัดการคำสั่งซื้อ</Text>
                  </View>
                  <View style={s.orderCountBadge}>
                    <Text style={s.orderCountText}>{adminOrders.length} ออเดอร์</Text>
                  </View>
                </View>

                {adminOrders.map(order => (
                  <View style={s.adminOrderCard} key={order.id}>
                    <View style={s.orderTop}>
                      <View>
                        <Text style={s.orderNumber}>Order #{order.id}</Text>
                        <Text style={s.orderCustomer}>ลูกค้า: {order.username}</Text>
                        <Text style={s.orderDate}>
                          {order.created_at ? new Date(order.created_at).toLocaleString('th-TH') : 'วันที่ไม่ระบุ'}
                        </Text>
                      </View>
                      <View style={[s.statusBadge, s[`status_${order.status}` as keyof typeof s] as any]}>
                        <Text style={s.statusText}>{statusLabel(order.status)}</Text>
                      </View>
                    </View>

                    <View style={s.orderDivider} />
                    <Text style={s.orderItemsTitle}>รายการที่ลูกค้าสั่ง</Text>

                    {Array.isArray(order.items) && order.items.length > 0 ? (
                      order.items.map((item: any, index: number) => (
                        <View style={s.orderItemRow} key={item.id ?? `${order.id}-${index}`}>
                          <View style={s.orderItemIcon}>
                            <Text>📱</Text>
                          </View>
                          <View style={s.orderItemInfo}>
                            <Text style={s.orderItemName}>{item.product_name || 'สินค้า'}</Text>
                            <Text style={s.orderItemMeta}>
                              ฿{money(item.price)} × {item.quantity} ชิ้น
                            </Text>
                          </View>
                          <Text style={s.orderItemSubtotal}>฿{money(item.subtotal)}</Text>
                        </View>
                      ))
                    ) : (
                      <Text style={s.muted}>ไม่พบรายละเอียดสินค้า</Text>
                    )}

                    <View style={s.adminOrderBottom}>
                      <View>
                        <Text style={s.orderTotalLabel}>ยอดรวม</Text>
                        <Text style={s.orderTotalPrice}>฿{money(order.total_price)}</Text>
                      </View>

                      <View style={s.statusActions}>
                        {[
                          ['pending', 'Pending'],
                          ['paid', 'Paid'],
                          ['shipping', 'Shipping'],
                          ['completed', 'Completed'],
                          ['cancelled', 'Cancel'],
                        ].map(([status, label]) => (
                          <Pressable
                            key={status}
                            style={[
                              s.statusButton,
                              s[`button_${status}` as keyof typeof s] as any,
                              order.status === status && s.statusButtonActive,
                            ]}
                            onPress={() => changeStatus(order.id, status)}
                          >
                            <Text style={s.statusButtonText}>{label}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  </View>
                ))}
              </>
            )}

          </>
        )}
      </ScrollView>

      {/* =====================================================
          ADD / EDIT PRODUCT MODAL
      ====================================================== */}

      <Modal
        visible={modal}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setModal(false)
        }
      >
        <View style={s.modal}>
          <View style={s.form}>
            <Text style={s.title}>
              {editingId === null
                ? 'เพิ่มสินค้า'
                : 'แก้ไขสินค้า'}
            </Text>

            <Input
              value={form.name}
              onChangeText={value =>
                setForm({
                  ...form,
                  name: value,
                })
              }
              placeholder="ชื่อสินค้า"
            />

            <Input
              value={form.brand}
              onChangeText={value =>
                setForm({
                  ...form,
                  brand: value,
                })
              }
              placeholder="แบรนด์"
            />

            <Input
              value={form.description}
              onChangeText={value =>
                setForm({
                  ...form,
                  description: value,
                })
              }
              placeholder="รายละเอียดสินค้า เช่น RAM 8GB / 256GB / สี..."
            />

            <Input
              value={form.price}
              onChangeText={value =>
                setForm({
                  ...form,
                  price: value,
                })
              }
              placeholder="ราคา"
              keyboardType="numeric"
            />

            <Input
              value={form.stock}
              onChangeText={value =>
                setForm({
                  ...form,
                  stock: value,
                })
              }
              placeholder="Stock"
              keyboardType="numeric"
            />

            <Input
              value={form.imageUrl}
              onChangeText={value =>
                setForm({
                  ...form,
                  imageUrl: value,
                })
              }
              placeholder="Image URL"
            />

            <View
              style={s.actions}
            >
              <Pressable
                style={[
                  s.primary,
                  { flex: 1 },
                ]}
                onPress={save}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator
                    color="#07111F"
                  />
                ) : (
                  <Text
                    style={
                      s.primaryText
                    }
                  >
                    บันทึก
                  </Text>
                )}
              </Pressable>

              <Pressable
                style={[
                  s.smallBtn,
                  { flex: 1 },
                ]}
                onPress={() => {
                  setModal(false);
                  setEditingId(null);
                  setForm(empty);
                }}
              >
                <Text>
                  ยกเลิก
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ===========================================================
// INPUT
// ===========================================================

type InputProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secure?: boolean;
  keyboardType?:
    | 'default'
    | 'numeric'
    | 'email-address';
};

const Input = ({
  value,
  onChangeText,
  placeholder,
  secure = false,
  keyboardType = 'default',
}: InputProps) => (
  <TextInput
    style={s.input}
    value={value}
    onChangeText={onChangeText}
    placeholder={placeholder}
    placeholderTextColor="#718096"
    secureTextEntry={secure}
    autoCapitalize="none"
    autoCorrect={false}
    keyboardType={keyboardType}
  />
);

// ===========================================================
// AUTH
// ===========================================================

type AuthProps = {
  reg?: boolean;
  user: string;
  pass: string;
  confirm: string;
  setUser: (value: string) => void;
  setPass: (value: string) => void;
  setConfirm: (value: string) => void;
  busy: boolean;
  submit: () => void;
  switchPage: () => void;
};

const Auth = ({
  reg = false,
  user,
  pass,
  confirm,
  setUser,
  setPass,
  setConfirm,
  busy,
  submit,
  switchPage,
}: AuthProps) => (
  <View style={s.center}>
    <View style={s.auth}>
      <Text style={s.kicker}>
        {reg
          ? 'CREATE ACCOUNT'
          : 'WELCOME BACK'}
      </Text>

      <Text style={s.big}>
        {reg
          ? 'สมัครสมาชิก'
          : 'เข้าสู่ระบบ'}
      </Text>

      <Text style={s.muted}>
        NoonMobile • SMARTPHONE STORE
      </Text>

      <Input
        value={user}
        onChangeText={setUser}
        placeholder="Username"
      />

      <Input
        value={pass}
        onChangeText={setPass}
        placeholder="Password"
        secure
      />

      {reg && (
        <Input
          value={confirm}
          onChangeText={setConfirm}
          placeholder="Confirm password"
          secure
        />
      )}

      <Pressable
        style={[
          s.primary,
          busy && s.disabled,
        ]}
        onPress={submit}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color="#07111F" />
        ) : (
          <Text style={s.primaryText}>
            {reg
              ? 'สร้างบัญชี'
              : 'เข้าสู่ระบบ'}
          </Text>
        )}
      </Pressable>

      <Pressable
        onPress={switchPage}
      >
        <Text style={s.link}>
          {reg
            ? 'มีบัญชีแล้ว? เข้าสู่ระบบ'
            : 'ยังไม่มีบัญชี? สมัครสมาชิก'}
        </Text>
      </Pressable>
    </View>
  </View>
);

// ===========================================================
// STYLES
// ===========================================================

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#070B12',
  },

  content: {
    padding: 18,
    maxWidth: 1100,
    width: '100%',
    alignSelf: 'center',
  },

  header: {
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#182231',
  },

  logo: {
    color: '#FFF',
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  logo2: {
    color: '#67E8F9',
  },

  navrow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },

  nav: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#111927',
  },

  navText: {
    color: '#D8E1EC',
    fontWeight: '700',
    fontSize: 12,
  },

  hero: {
    paddingVertical: 28,
  },

  kicker: {
    color: '#67E8F9',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  heroTitle: {
    color: '#FFF',
    fontSize: 38,
    lineHeight: 43,
    fontWeight: '900',
    marginVertical: 8,
  },

  title: {
    color: '#FFF',
    fontSize: 25,
    fontWeight: '900',
    marginBottom: 8,
  },

  big: {
    color: '#FFF',
    fontSize: 31,
    fontWeight: '900',
    marginVertical: 5,
  },

  muted: {
    color: '#8492A6',
    marginBottom: 12,
  },

  input: {
    backgroundColor: '#101827',
    borderWidth: 1,
    borderColor: '#223044',
    color: '#FFF',
    borderRadius: 13,
    padding: 13,
    marginVertical: 6,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },

  card: {
    width: '31.5%',
    minWidth: 250,
    backgroundColor: '#0E1623',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1A2738',
  },

  image: {
    width: '100%',
    height: 170,
  },

  cardbody: {
    padding: 14,
  },

  brand: {
    color: '#67E8F9',
    fontSize: 11,
    fontWeight: '900',
  },

  name: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
    marginVertical: 4,
  },

  price: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '900',
  },

  stock: {
    color: '#718096',
    fontSize: 11,
    marginBottom: 9,
  },

  smallPrimary: {
    backgroundColor: '#67E8F9',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },

  smallText: {
    color: '#07111F',
    fontWeight: '900',
  },

  shopToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 18,
    marginBottom: 10,
  },

  shopTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '900',
  },

  shopSubtitle: {
    color: '#718096',
    fontSize: 12,
    marginTop: 2,
  },

  priceSortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },

  sortLabel: {
    color: '#A8B4C5',
    fontSize: 12,
    fontWeight: '800',
    marginRight: 2,
  },

  sortButton: {
    borderWidth: 1,
    borderColor: '#263A52',
    backgroundColor: '#0B1728',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },

  sortButtonActive: {
    backgroundColor: '#67E8F9',
    borderColor: '#67E8F9',
  },

  sortButtonText: {
    color: '#B8C5D6',
    fontSize: 11,
    fontWeight: '900',
  },

  sortButtonTextActive: {
    color: '#07111F',
  },

  primary: {
    backgroundColor: '#67E8F9',
    padding: 14,
    borderRadius: 13,
    alignItems: 'center',
    marginVertical: 7,
  },

  primaryText: {
    color: '#07111F',
    fontWeight: '900',
  },

  disabled: {
    opacity: 0.5,
  },

  link: {
    color: '#67E8F9',
    textAlign: 'center',
    margin: 14,
    fontWeight: '700',
  },

  center: {
    minHeight: 600,
    justifyContent: 'center',
    alignItems: 'center',
  },

  auth: {
    width: '100%',
    maxWidth: 430,
    backgroundColor: '#0E1623',
    padding: 25,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1F3045',
  },

  /* ========================================================
     CART
  ======================================================== */

  cartSummary: {
    color: '#8492A6',
    fontSize: 13,
    marginBottom: 14,
  },

  emptyCart: {
    backgroundColor: '#0E1623',
    borderRadius: 18,
    padding: 35,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#18283A',
  },

  emptyIcon: {
    fontSize: 45,
    marginBottom: 10,
  },

  emptyTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 6,
  },

  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0E1623',
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#18283A',
  },

  cartImage: {
    width: 85,
    height: 85,
    borderRadius: 12,
  },

  cartInfo: {
    flex: 1,
  },

  cartName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
  },

  cartBrand: {
    color: '#67E8F9',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },

  cartPrice: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 4,
  },

  cartStock: {
    color: '#718096',
    fontSize: 11,
    marginTop: 2,
  },

  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 6,
  },

  quantityButton: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: '#1A2636',
    alignItems: 'center',
    justifyContent: 'center',
  },

  quantityButtonDisabled: {
    opacity: 0.35,
  },

  quantityButtonLast: {
    opacity: 0.75,
  },

  quantityButtonText: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 24,
  },

  quantityBox: {
    minWidth: 42,
    height: 34,
    borderRadius: 9,
    backgroundColor: '#101827',
    borderWidth: 1,
    borderColor: '#2A3A50',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },

  quantityNumber: {
    color: '#67E8F9',
    fontSize: 16,
    fontWeight: '900',
  },

  removeButton: {
    marginLeft: 5,
    backgroundColor: '#4A2027',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 9,
  },

  removeText: {
    color: '#FF9B9B',
    fontWeight: '900',
    fontSize: 12,
  },

  itemTotalBox: {
    alignSelf: 'flex-start',
  },

  itemTotal: {
    color: '#67E8F9',
    fontSize: 15,
    fontWeight: '900',
  },

  checkoutBox: {
    backgroundColor: '#0E1623',
    padding: 17,
    borderRadius: 17,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#1C3045',
  },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },

  totalLabel: {
    color: '#8492A6',
    fontSize: 14,
  },

  totalValue: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 14,
  },

  totalPrice: {
    color: '#67E8F9',
    fontSize: 25,
    fontWeight: '900',
  },

  /* ========================================================
     OTHER
  ======================================================== */

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0E1623',
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
  },

  thumb: {
    width: 55,
    height: 55,
    borderRadius: 10,
  },

  qty: {
    backgroundColor: '#1A2636',
    padding: 9,
    borderRadius: 9,
  },

  qtynum: {
    color: '#FFF',
    fontWeight: '900',
  },

  total: {
    color: '#67E8F9',
    fontSize: 23,
    fontWeight: '900',
    textAlign: 'right',
    marginVertical: 14,
  },

  productDescription: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
    minHeight: 36,
    marginBottom: 6,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },

  adminSectionTitle: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 3,
  },

  orderCountBadge: {
    backgroundColor: '#172554',
    borderWidth: 1,
    borderColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },

  orderCountText: {
    color: '#93C5FD',
    fontWeight: '900',
    fontSize: 12,
  },

  emptyOrder: {
    backgroundColor: '#0E1623',
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E3A5F',
  },

  orderCard: {
    backgroundColor: '#0E1623',
    borderRadius: 20,
    padding: 17,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },

  adminOrderCard: {
    backgroundColor: '#0B1420',
    borderRadius: 20,
    padding: 17,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#263B54',
  },

  orderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },

  orderNumber: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
  },

  orderCustomer: {
    color: '#67E8F9',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },

  orderDate: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 4,
  },

  statusBadge: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },

  statusText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '900',
  },

  status_pending: {
    backgroundColor: '#422006',
    borderColor: '#F59E0B',
  },
  status_paid: {
    backgroundColor: '#052E16',
    borderColor: '#22C55E',
  },
  status_shipping: {
    backgroundColor: '#172554',
    borderColor: '#3B82F6',
  },
  status_completed: {
    backgroundColor: '#064E3B',
    borderColor: '#10B981',
  },
  status_cancelled: {
    backgroundColor: '#450A0A',
    borderColor: '#EF4444',
  },

  orderDivider: {
    height: 1,
    backgroundColor: '#1E293B',
    marginVertical: 13,
  },

  orderItemsTitle: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 8,
  },

  orderItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },

  orderItemIcon: {
    width: 42,
    height: 42,
    borderRadius: 11,
    backgroundColor: '#111C2B',
    alignItems: 'center',
    justifyContent: 'center',
  },

  orderItemInfo: {
    flex: 1,
  },

  orderItemName: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 13,
  },

  orderItemMeta: {
    color: '#718096',
    fontSize: 11,
    marginTop: 3,
  },

  orderItemSubtotal: {
    color: '#67E8F9',
    fontWeight: '900',
    fontSize: 13,
  },

  orderTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    marginTop: 10,
    paddingTop: 13,
  },

  orderTotalLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },

  orderTotalPrice: {
    color: '#67E8F9',
    fontSize: 21,
    fontWeight: '900',
  },

  adminOrderBottom: {
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    marginTop: 12,
    paddingTop: 13,
    gap: 12,
  },

  statusActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },

  statusButton: {
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },

  statusButtonActive: {
    transform: [{ scale: 1.03 }],
    borderWidth: 2,
  },

  statusButtonText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '900',
  },

  button_pending: {
    backgroundColor: '#92400E',
    borderColor: '#F59E0B',
  },
  button_paid: {
    backgroundColor: '#166534',
    borderColor: '#22C55E',
  },
  button_shipping: {
    backgroundColor: '#1D4ED8',
    borderColor: '#60A5FA',
  },
  button_completed: {
    backgroundColor: '#047857',
    borderColor: '#34D399',
  },
  button_cancelled: {
    backgroundColor: '#B91C1C',
    borderColor: '#F87171',
  },

  adminProductInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },

  adminProductBrand: {
    color: '#67E8F9',
    fontSize: 12,
    fontWeight: '900',
  },

  adminProductPrice: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
  },

  adminProductStock: {
    color: '#94A3B8',
    fontSize: 12,
  },

  adminDescription: {
    color: '#718096',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },

  box: {
    backgroundColor: '#0E1623',
    padding: 15,
    borderRadius: 15,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#18283A',
  },

  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },

  tab: {
    flex: 1,
    padding: 12,
    borderRadius: 11,
    backgroundColor: '#101827',
    alignItems: 'center',
  },

  active: {
    backgroundColor: '#24364C',
  },

  tabtext: {
    color: '#FFF',
    fontWeight: '800',
  },

  actions: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 9,
  },

  smallBtn: {
    backgroundColor: '#D8E1EC',
    padding: 9,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },

  danger: {
    backgroundColor: '#FF8A8A',
    padding: 9,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    padding: 18,
  },

  form: {
    backgroundColor: '#0E1623',
    padding: 20,
    borderRadius: 22,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
});