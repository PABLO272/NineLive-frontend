import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import React from "react";
import {
  Alert,
  Animated,
  Easing,
  FlatList,
  Image,
  LayoutAnimation,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
  useColorScheme,
  useWindowDimensions
} from "react-native";
import { LiveStream, Product } from "@ninelive/shared";
import { sampleFeed } from "./src/screens/sampleFeed";

type AppTab = "home" | "goLive" | "cart" | "profile";
type HomeFeedTab = "explore" | "forYou" | "following";
type AuthMode = "welcome" | "signin" | "signup";
type AppearanceMode = "system" | "light" | "dark";

type ReservationLine = {
  id: string;
  streamId: string;
  product: Product;
  quantity: number;
  reservedUntil: number;
};

type Order = {
  id: string;
  buyerName: string;
  items: ReservationLine[];
  totalTokens: number;
  createdAt: number;
};

type GoLiveDraftProduct = {
  template: Product;
  selected: boolean;
  inventory: number;
};

type ChatMessage = {
  id: string;
  author: string;
  body: string;
  at: number;
};

type QueueItem = {
  id: string;
  buyerName: string;
  type: "reserved" | "ordered";
  productTitle: string;
  quantity: number;
  tokens: number;
  at: number;
};

const RESERVATION_WINDOW_MS = 10 * 60 * 1000;
const ThemeModeContext = React.createContext<boolean>(true);

function stockKey(streamId: string, productId: string): string {
  return `${streamId}::${productId}`;
}

function defaultStockForProduct(productId: string): number {
  const stockMap: Record<string, number> = {
    "p-1": 9,
    "p-2": 6,
    "p-3": 12,
    "p-4": 5
  };

  return stockMap[productId] ?? 8;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) {
    return "00:00";
  }

  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function deriveBuyerName(seed: string): string {
  const names = ["Ali", "Lina", "Sami", "Noor", "Huda", "Rayan", "Maya", "Omar"];
  let sum = 0;
  for (let i = 0; i < seed.length; i += 1) {
    sum += seed.charCodeAt(i);
  }
  return names[sum % names.length];
}

function ActionItem({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.actionItem} onPress={onPress}>
      <View style={styles.actionCircle}>
        <Text style={styles.actionIcon}>{label[0]}</Text>
      </View>
      <Text style={styles.actionValue}>{value}</Text>
    </TouchableOpacity>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  const isDarkMode = React.useContext(ThemeModeContext);
  return (
    <View style={[styles.statTile, !isDarkMode ? styles.statTileLight : null]}>
      <Text style={[styles.statTileValue, !isDarkMode ? styles.statTileValueLight : null]}>{value}</Text>
      <Text style={[styles.statTileLabel, !isDarkMode ? styles.statTileLabelLight : null]}>{label}</Text>
    </View>
  );
}

function CatCoinIcon({ size = 18 }: { size?: number }) {
  return (
    <View
      style={[
        styles.catCoinBase,
        {
          width: size,
          height: size,
          borderRadius: size / 2
        }
      ]}
    >
      <View style={styles.catCoinShine} />
      <View
        style={[
          styles.catCoinInnerRing,
          {
            width: size * 0.78,
            height: size * 0.78,
            borderRadius: (size * 0.78) / 2
          }
        ]}
      >
        <View
          style={[
            styles.catCoinHead,
            {
              width: size * 0.38,
              height: size * 0.34,
              borderRadius: size * 0.17
            }
          ]}
        >
          <View style={styles.catCoinEarLeft} />
          <View style={styles.catCoinEarRight} />
        </View>
      </View>
    </View>
  );
}

function SettingRow({
  title,
  subtitle,
  enabled,
  onToggle
}: {
  title: string;
  subtitle: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  const isDarkMode = React.useContext(ThemeModeContext);
  return (
    <TouchableOpacity style={[styles.settingRow, !isDarkMode ? styles.settingRowLight : null]} onPress={onToggle}>
      <View style={styles.settingTextWrap}>
        <Text style={[styles.settingTitle, !isDarkMode ? styles.settingTitleLight : null]}>{title}</Text>
        <Text style={[styles.settingSubtitle, !isDarkMode ? styles.settingSubtitleLight : null]}>{subtitle}</Text>
      </View>
      <View style={[styles.switchPill, enabled ? styles.switchPillActive : null]}>
        <View style={[styles.switchDot, enabled ? styles.switchDotActive : null]} />
      </View>
    </TouchableOpacity>
  );
}

function TabButton({
  label,
  icon,
  active,
  activeColor,
  inactiveColor,
  onPress
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  activeColor: string;
  inactiveColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.tabButton, pressed ? styles.tabButtonPressed : null]} onPress={onPress}>
      <Ionicons name={icon} size={20} color={active ? activeColor : inactiveColor} />
      <Text style={[styles.tabLabel, active ? { color: activeColor } : { color: inactiveColor }]}>{label}</Text>
    </Pressable>
  );
}

function getTouchDistance(
  touches: readonly { pageX: number; pageY: number }[] | { pageX: number; pageY: number }[]
): number {
  if (touches.length < 2) {
    return 0;
  }
  const a = touches[0];
  const b = touches[1];
  const dx = a.pageX - b.pageX;
  const dy = a.pageY - b.pageY;
  return Math.sqrt(dx * dx + dy * dy);
}

function AnimatedCatMascot() {
  const bob = React.useRef(new Animated.Value(0)).current;
  const blink = React.useRef(new Animated.Value(0)).current;
  const tailSwing = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const bobLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true })
      ])
    );
    const blinkLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 0, duration: 2200, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 0, duration: 90, useNativeDriver: true })
      ])
    );
    const tailLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(tailSwing, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(tailSwing, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true })
      ])
    );
    bobLoop.start();
    blinkLoop.start();
    tailLoop.start();
    return () => {
      bobLoop.stop();
      blinkLoop.stop();
      tailLoop.stop();
    };
  }, [bob, blink, tailSwing]);

  const bobTranslate = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const eyeScaleY = blink.interpolate({ inputRange: [0, 1], outputRange: [1, 0.12] });
  const tailRotate = tailSwing.interpolate({ inputRange: [0, 1], outputRange: ["-22deg", "-6deg"] });

  return (
    <Animated.View style={[styles.catWrap, { transform: [{ translateY: bobTranslate }] }]}>
      <View style={styles.catHead}>
        <View style={[styles.catEar, styles.catEarLeft]} />
        <View style={[styles.catEarInner, styles.catEarInnerLeft]} />
        <View style={[styles.catEar, styles.catEarRight]} />
        <View style={[styles.catEarInner, styles.catEarInnerRight]} />
        <View style={styles.catEyeRow}>
          <Animated.View style={[styles.catEye, { transform: [{ scaleY: eyeScaleY }] }]}>
            <View style={styles.catEyeInner} />
            <View style={styles.catPupil} />
            <View style={styles.catEyeSpark} />
          </Animated.View>
          <Animated.View style={[styles.catEye, { transform: [{ scaleY: eyeScaleY }] }]}>
            <View style={styles.catEyeInner} />
            <View style={styles.catPupil} />
            <View style={styles.catEyeSpark} />
          </Animated.View>
        </View>
        <View style={styles.catMuzzle} />
        <View style={styles.catNose} />
        <View style={styles.catMouthLine} />
        <View style={styles.catWhiskerLeftTop} />
        <View style={styles.catWhiskerLeftBottom} />
        <View style={styles.catWhiskerRightTop} />
        <View style={styles.catWhiskerRightBottom} />
      </View>
      <View style={styles.catBody}>
        <View style={styles.catBelly} />
        <View style={styles.catCollar} />
        <View style={styles.catBell} />
        <View style={styles.catLegRow}>
          <View style={styles.catLeg}>
            <View style={styles.catPaw} />
          </View>
          <View style={styles.catLeg}>
            <View style={styles.catPaw} />
          </View>
        </View>
      </View>
      <Animated.View style={[styles.catTail, { transform: [{ rotate: tailRotate }] }]}>
        <View style={styles.catTailTip} />
      </Animated.View>
    </Animated.View>
  );
}

export default function App() {
  const { height } = useWindowDimensions();
  const systemColorScheme = useColorScheme();
  const cardHeight = Math.max(560, Math.floor(height * 0.86));

  const [authUser, setAuthUser] = React.useState<{ name: string; email: string } | null>(null);
  const [authMode, setAuthMode] = React.useState<AuthMode>("welcome");
  const [authName, setAuthName] = React.useState("");
  const [authEmail, setAuthEmail] = React.useState("");
  const [authPassword, setAuthPassword] = React.useState("");
  const [authConfirmPassword, setAuthConfirmPassword] = React.useState("");
  const [authAcceptedTerms, setAuthAcceptedTerms] = React.useState(false);
  const [authProcessing, setAuthProcessing] = React.useState(false);
  const [profileSetupNeeded, setProfileSetupNeeded] = React.useState(false);
  const [appearanceMode, setAppearanceMode] = React.useState<AppearanceMode>("system");

  const [activeTab, setActiveTab] = React.useState<AppTab>("home");
  const [homeFeedTab, setHomeFeedTab] = React.useState<HomeFeedTab>("forYou");
  const [selectedCategory, setSelectedCategory] = React.useState("All");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchModalVisible, setSearchModalVisible] = React.useState(false);
  const [streams, setStreams] = React.useState<LiveStream[]>(sampleFeed.streams);
  const [followedStreamers, setFollowedStreamers] = React.useState<Record<string, boolean>>({});
  const [selectedStreamId, setSelectedStreamId] = React.useState<string | null>(null);
  const [viewerRoomLikes, setViewerRoomLikes] = React.useState<Record<string, number>>({});
  const [viewerRoomChat, setViewerRoomChat] = React.useState<Record<string, ChatMessage[]>>({});
  const [viewerCommentInput, setViewerCommentInput] = React.useState("");

  const [tokenBalance, setTokenBalance] = React.useState(1800);
  const [tokenRechargeVisible, setTokenRechargeVisible] = React.useState(false);
  const [selectedRechargeTokens, setSelectedRechargeTokens] = React.useState(800);
  const [paymentMethod, setPaymentMethod] = React.useState<"card" | "apple" | "google">("card");
  const [useCustomRecharge, setUseCustomRecharge] = React.useState(false);
  const [customRechargeInput, setCustomRechargeInput] = React.useState("");
  const [payName, setPayName] = React.useState("");
  const [payCard, setPayCard] = React.useState("");
  const [payExpiry, setPayExpiry] = React.useState("");
  const [payCvv, setPayCvv] = React.useState("");
  const [payEmail, setPayEmail] = React.useState("");
  const [paymentProcessing, setPaymentProcessing] = React.useState(false);
  const [reservations, setReservations] = React.useState<ReservationLine[]>([]);
  const [orders, setOrders] = React.useState<Order[]>([]);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [cameraFacing, setCameraFacing] = React.useState<"front" | "back">("front");
  const itemCameraRef = React.useRef<CameraView | null>(null);
  const [streamTitle, setStreamTitle] = React.useState("Tonight Cat Coins drop");
  const [streamCategory, setStreamCategory] = React.useState("Fashion");
  const [micMuted, setMicMuted] = React.useState(false);
  const [saveReplay, setSaveReplay] = React.useState(true);
  const [newItemName, setNewItemName] = React.useState("");
  const [newItemDescription, setNewItemDescription] = React.useState("");
  const [newItemPrice, setNewItemPrice] = React.useState("120");
  const [newItemInventory, setNewItemInventory] = React.useState("8");
  const [newItemPhotoUri, setNewItemPhotoUri] = React.useState<string | null>(null);
  const [itemCameraModalVisible, setItemCameraModalVisible] = React.useState(false);
  const [itemCameraFacing, setItemCameraFacing] = React.useState<"front" | "back">("back");
  const [itemCapturedPreviewUri, setItemCapturedPreviewUri] = React.useState<string | null>(null);
  const [capturingItemPhoto, setCapturingItemPhoto] = React.useState(false);
  const [liveOrdersVisible, setLiveOrdersVisible] = React.useState(false);
  const [liveSettingsVisible, setLiveSettingsVisible] = React.useState(false);

  const [displayName, setDisplayName] = React.useState("Nora Seller");
  const [username, setUsername] = React.useState("nora_seller");
  const [profileAvatar, setProfileAvatar] = React.useState(sampleFeed.streams[0]?.streamer.avatarUrl ?? "");
  const [bio, setBio] = React.useState("Daily live drops with limited Cat Coins items.");
  const [profileSetupAvatarUrl, setProfileSetupAvatarUrl] = React.useState("");
  const [emailAlerts, setEmailAlerts] = React.useState(true);
  const [pushAlerts, setPushAlerts] = React.useState(true);
  const [activeLiveStreamId, setActiveLiveStreamId] = React.useState<string | null>(null);
  const [liveStartedAt, setLiveStartedAt] = React.useState<number | null>(null);
  const [liveChat, setLiveChat] = React.useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = React.useState("");
  const [liveStatsTick, setLiveStatsTick] = React.useState(0);
  const [pinnedProductByStream, setPinnedProductByStream] = React.useState<Record<string, string | null>>({});
  const [mutedAuthors, setMutedAuthors] = React.useState<Record<string, boolean>>({});
  const [hiddenChatIds, setHiddenChatIds] = React.useState<Record<string, boolean>>({});
  const [blockedKeywords, setBlockedKeywords] = React.useState<string[]>(["spam"]);
  const [blockedKeywordInput, setBlockedKeywordInput] = React.useState("");
  const isDarkMode =
    appearanceMode === "system" ? (systemColorScheme ?? "dark") === "dark" : appearanceMode === "dark";
  const ui = React.useMemo(
    () => ({
      appBg: isDarkMode ? "#050505" : "#f4f5f7",
      sectionBg: isDarkMode ? "#090909" : "#f4f5f7",
      tabBg: isDarkMode ? "rgba(10,10,10,0.92)" : "rgba(255,255,255,0.95)",
      tabBorder: isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(20,20,20,0.14)",
      label: isDarkMode ? "#ffffff" : "#101010",
      subLabel: isDarkMode ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.6)",
      outline: isDarkMode ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.25)"
    }),
    [isDarkMode]
  );
  const surfaces = React.useMemo(
    () => ({
      cardBg: isDarkMode ? "#151515" : "#ffffff",
      cardBorder: isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(20,20,20,0.12)",
      inputBg: isDarkMode ? "#1d1d1d" : "#ffffff",
      inputBorder: isDarkMode ? "rgba(255,255,255,0.14)" : "rgba(20,20,20,0.18)",
      inputText: isDarkMode ? "#ffffff" : "#111111",
      sheetBg: isDarkMode ? "#121212" : "#ffffff",
      title: isDarkMode ? "#ffffff" : "#111111",
      body: isDarkMode ? "#d0d0d0" : "#555555"
    }),
    [isDarkMode]
  );

  const normalizeUsername = React.useCallback((value: string) => {
    const cleaned = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
    return cleaned.slice(0, 20);
  }, []);

  const completeAuth = React.useCallback((name: string, email: string) => {
    setAuthUser({ name, email });
    setDisplayName(name);
    setUsername(normalizeUsername(name) || "ninelive_user");
    setProfileSetupNeeded(false);
    setAuthMode("welcome");
    setAuthName("");
    setAuthEmail("");
    setAuthPassword("");
    setAuthConfirmPassword("");
    setAuthAcceptedTerms(false);
    setActiveTab("home");
  }, [normalizeUsername]);

  const beginNewAccountOnboarding = React.useCallback((name: string, email: string) => {
    setAuthUser({ name, email });
    setDisplayName(name.trim());
    setUsername(normalizeUsername(name) || "ninelive_user");
    setBio("Tell viewers what you stream and what drops they can expect.");
    setProfileAvatar(sampleFeed.streams[0]?.streamer.avatarUrl ?? "");
    setProfileSetupAvatarUrl("");
    setProfileSetupNeeded(true);
    setAuthMode("welcome");
    setAuthName("");
    setAuthEmail("");
    setAuthPassword("");
    setAuthConfirmPassword("");
    setAuthAcceptedTerms(false);
  }, [normalizeUsername]);

  const handleSocialAuth = (provider: "google" | "icloud") => {
    setAuthProcessing(true);
    setTimeout(() => {
      setAuthProcessing(false);
      if (provider === "google") {
        completeAuth("Google User", "google.user@ninelive.app");
      } else {
        completeAuth("iCloud User", "icloud.user@ninelive.app");
      }
    }, 700);
  };

  const handleEmailSignIn = () => {
    if (!authEmail.includes("@")) {
      Alert.alert("Invalid email", "Please enter a valid email address.");
      return;
    }
    if (authPassword.trim().length < 6) {
      Alert.alert("Invalid password", "Password should be at least 6 characters.");
      return;
    }
    setAuthProcessing(true);
    setTimeout(() => {
      setAuthProcessing(false);
      const nameFromEmail = authEmail.split("@")[0] || "Ninelive User";
      completeAuth(nameFromEmail, authEmail.trim().toLowerCase());
    }, 650);
  };

  const handleCreateAccount = () => {
    if (!authName.trim()) {
      Alert.alert("Missing name", "Please enter your full name.");
      return;
    }
    if (!authEmail.includes("@")) {
      Alert.alert("Invalid email", "Please enter a valid email address.");
      return;
    }
    if (authPassword.trim().length < 8) {
      Alert.alert("Weak password", "Use at least 8 characters for better security.");
      return;
    }
    if (authPassword !== authConfirmPassword) {
      Alert.alert("Passwords do not match", "Please confirm your password correctly.");
      return;
    }
    if (!authAcceptedTerms) {
      Alert.alert("Terms required", "Please accept terms and privacy policy to continue.");
      return;
    }
    setAuthProcessing(true);
    setTimeout(() => {
      setAuthProcessing(false);
      beginNewAccountOnboarding(authName.trim(), authEmail.trim().toLowerCase());
    }, 800);
  };

  const completeProfileSetup = () => {
    if (!displayName.trim()) {
      Alert.alert("Missing name", "Please enter your display name.");
      return;
    }
    const cleanUser = normalizeUsername(username);
    if (cleanUser.length < 3) {
      Alert.alert("Invalid username", "Username should be at least 3 characters.");
      return;
    }
    if (!bio.trim()) {
      Alert.alert("Missing bio", "Please add a short bio.");
      return;
    }
    if (!profileAvatar.trim()) {
      Alert.alert("Missing photo", "Please choose a profile photo.");
      return;
    }
    setUsername(cleanUser);
    setProfileSetupNeeded(false);
    setActiveTab("home");
    Alert.alert("Profile ready", "Your account setup is complete.");
  };
  const screenTransition = React.useRef(new Animated.Value(1)).current;
  const livePulse = React.useRef(new Animated.Value(0)).current;
  const rechargePackages = React.useMemo(
    () => [
      { tokens: 300, usd: 4.99, badge: "Starter" },
      { tokens: 800, usd: 11.99, badge: "Best Offer" },
      { tokens: 1500, usd: 19.99, badge: "Best Value" },
      { tokens: 3200, usd: 37.99, badge: "Mega Deal" }
    ],
    []
  );
  const customRechargeTokens = React.useMemo(() => Math.floor(Number(customRechargeInput)), [customRechargeInput]);
  const customRechargeValid = Number.isFinite(customRechargeTokens) && customRechargeTokens >= 100 && customRechargeTokens <= 5000;
  const customRechargeTotal = React.useMemo(() => {
    if (!customRechargeValid) {
      return 0;
    }
    const flexibleRatePerToken = 0.0185;
    const processingFee = 0.99;
    return customRechargeTokens * flexibleRatePerToken + processingFee;
  }, [customRechargeTokens, customRechargeValid]);
  const activePackage = React.useMemo(
    () => rechargePackages.find((pack) => pack.tokens === selectedRechargeTokens) ?? rechargePackages[0],
    [rechargePackages, selectedRechargeTokens]
  );
  const profileAvatarOptions = React.useMemo(
    () => [
      sampleFeed.streams[0]?.streamer.avatarUrl ?? "",
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80",
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80",
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&q=80",
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80"
    ].filter(Boolean),
    []
  );

  React.useEffect(() => {
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const runSmoothLayout = React.useCallback(() => {
    LayoutAnimation.configureNext({
      duration: 220,
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity }
    });
  }, []);

  React.useEffect(() => {
    screenTransition.setValue(0.88);
    Animated.timing(screenTransition, {
      toValue: 1,
      duration: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [activeTab, homeFeedTab, selectedStreamId, activeLiveStreamId, screenTransition]);

  React.useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(livePulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true
        }),
        Animated.timing(livePulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true
        })
      ])
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [livePulse]);

  const [stockByKey, setStockByKey] = React.useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    sampleFeed.streams.forEach((stream) => {
      stream.featuredProducts.forEach((product) => {
        initial[stockKey(stream.id, product.id)] = defaultStockForProduct(product.id);
      });
    });
    return initial;
  });

  const productCatalog = React.useMemo(() => {
    const byId: Record<string, Product> = {};
    sampleFeed.streams.forEach((stream) => {
      stream.featuredProducts.forEach((product) => {
        byId[product.id] = product;
      });
    });
    return Object.values(byId);
  }, []);

  const [goLiveDraftProducts, setGoLiveDraftProducts] = React.useState<GoLiveDraftProduct[]>(() =>
    productCatalog.map((product) => ({ template: product, selected: false, inventory: 8 }))
  );

  const streamById = React.useMemo(() => {
    const map: Record<string, LiveStream> = {};
    streams.forEach((stream) => {
      map[stream.id] = stream;
    });
    return map;
  }, [streams]);
  const categoryOptions = React.useMemo(() => {
    const predefined = ["All", "Fashion", "Beauty", "Home", "Tech", "Gaming", "Food", "Wellness", "Sports"];
    const dynamic = streams.map((stream) => stream.category);
    return Array.from(new Set([...predefined, ...dynamic]));
  }, [streams]);

  const selectedStream = selectedStreamId ? streamById[selectedStreamId] : null;
  const activeLiveStream = activeLiveStreamId ? streamById[activeLiveStreamId] : null;

  const isFollowing = React.useCallback(
    (streamerId: string) => Boolean(followedStreamers[streamerId]),
    [followedStreamers]
  );

  const getStock = React.useCallback(
    (streamId: string, productId: string) => stockByKey[stockKey(streamId, productId)] ?? 0,
    [stockByKey]
  );

  const feedData = React.useMemo(() => {
    const liveOnly = streams.filter((stream) => stream.status === "live");
    const followFiltered =
      homeFeedTab === "following"
        ? liveOnly.filter((stream) => isFollowing(stream.streamer.id))
        : liveOnly;
    const categoryFiltered =
      selectedCategory === "All"
        ? followFiltered
        : followFiltered.filter((stream) => stream.category.toLowerCase() === selectedCategory.toLowerCase());
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return categoryFiltered;
    }
    return categoryFiltered.filter((stream) => {
      const byTitle = stream.title.toLowerCase().includes(q);
      const byCategory = stream.category.toLowerCase().includes(q);
      const byStreamer = stream.streamer.displayName.toLowerCase().includes(q);
      return byTitle || byCategory || byStreamer;
    });
  }, [homeFeedTab, streams, isFollowing, selectedCategory, searchQuery]);

  const reservedTokens = React.useMemo(
    () => reservations.reduce((sum, line) => sum + line.product.price * line.quantity, 0),
    [reservations]
  );
  const availableTokens = Math.max(tokenBalance - reservedTokens, 0);
  const cartCount = React.useMemo(
    () => reservations.reduce((sum, line) => sum + line.quantity, 0),
    [reservations]
  );
  const totalSpentTokens = React.useMemo(
    () => orders.reduce((sum, order) => sum + order.totalTokens, 0),
    [orders]
  );
  const activeLiveReservations = React.useMemo(
    () =>
      activeLiveStreamId
        ? reservations.filter((line) => line.streamId === activeLiveStreamId)
        : [],
    [reservations, activeLiveStreamId]
  );
  const activeLiveReservedCount = React.useMemo(
    () => activeLiveReservations.reduce((sum, line) => sum + line.quantity, 0),
    [activeLiveReservations]
  );
  const activeLiveReservedTokens = React.useMemo(
    () => activeLiveReservations.reduce((sum, line) => sum + line.quantity * line.product.price, 0),
    [activeLiveReservations]
  );
  const activeLiveOrderCount = React.useMemo(
    () =>
      orders.filter((order) => order.items.some((line) => line.streamId === activeLiveStreamId)).length,
    [orders, activeLiveStreamId]
  );
  const activeLiveSoldTokens = React.useMemo(
    () =>
      orders.reduce((sum, order) => {
        const liveLineTotal = order.items
          .filter((line) => line.streamId === activeLiveStreamId)
          .reduce((lineSum, line) => lineSum + line.quantity * line.product.price, 0);
        return sum + liveLineTotal;
      }, 0),
    [orders, activeLiveStreamId]
  );
  const activeLiveViewerCount = React.useMemo(() => {
    if (!activeLiveStream) {
      return 0;
    }

    const base = activeLiveStream.viewerCount;
    const wave = Math.floor(22 * Math.sin(liveStatsTick / 2.4));
    const boost = activeLiveReservedCount * 4 + activeLiveOrderCount * 11;
    return Math.max(0, base + wave + boost);
  }, [activeLiveStream, liveStatsTick, activeLiveReservedCount, activeLiveOrderCount]);
  const pinnedProduct = React.useMemo(() => {
    if (!activeLiveStreamId || !activeLiveStream) {
      return null;
    }
    const pinnedId = pinnedProductByStream[activeLiveStreamId];
    if (!pinnedId) {
      return null;
    }
    return activeLiveStream.featuredProducts.find((product) => product.id === pinnedId) ?? null;
  }, [activeLiveStreamId, activeLiveStream, pinnedProductByStream]);
  const activeLiveQueue = React.useMemo<QueueItem[]>(() => {
    if (!activeLiveStreamId) {
      return [];
    }

    const reservedQueue: QueueItem[] = activeLiveReservations.map((line) => ({
      id: `q-res-${line.id}`,
      buyerName: deriveBuyerName(line.id),
      type: "reserved",
      productTitle: line.product.title,
      quantity: line.quantity,
      tokens: line.product.price * line.quantity,
      at: line.reservedUntil - RESERVATION_WINDOW_MS
    }));

    const orderedQueue: QueueItem[] = orders.flatMap((order) =>
      order.items
        .filter((line) => line.streamId === activeLiveStreamId)
        .map((line) => ({
          id: `q-ord-${order.id}-${line.id}`,
          buyerName: order.buyerName,
          type: "ordered",
          productTitle: line.product.title,
          quantity: line.quantity,
          tokens: line.product.price * line.quantity,
          at: order.createdAt
        }))
    );

    return [...orderedQueue, ...reservedQueue].sort((a, b) => b.at - a.at).slice(0, 12);
  }, [activeLiveStreamId, activeLiveReservations, orders]);

  React.useEffect(() => {
    setStockByKey((prev) => {
      const next = { ...prev };
      let changed = false;
      streams.forEach((stream) => {
        stream.featuredProducts.forEach((product) => {
          const key = stockKey(stream.id, product.id);
          if (next[key] === undefined) {
            next[key] = defaultStockForProduct(product.id);
            changed = true;
          }
        });
      });
      return changed ? next : prev;
    });
  }, [streams]);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setReservations((prev) => {
        const now = Date.now();
        const expired = prev.filter((line) => line.reservedUntil <= now);
        if (expired.length === 0) {
          return prev;
        }

        setStockByKey((stockPrev) => {
          const next = { ...stockPrev };
          expired.forEach((line) => {
            const key = stockKey(line.streamId, line.product.id);
            next[key] = (next[key] ?? 0) + line.quantity;
          });
          return next;
        });

        return prev.filter((line) => line.reservedUntil > now);
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    if (!activeLiveStreamId) {
      return;
    }

    const tick = setInterval(() => {
      setLiveStatsTick((prev) => prev + 1);
    }, 2000);

    const autoChat = setInterval(() => {
      const authors = ["viewer_ali", "viewer_lina", "viewer_sami", "viewer_noor"];
      const canned = [
        "Is this still available?",
        "I just reserved one.",
        "Can you show close-up details?",
        "Shipping time please?",
        "Love this drop!"
      ];
      const author = authors[Math.floor(Math.random() * authors.length)];
      const body = canned[Math.floor(Math.random() * canned.length)];
      setLiveChat((prev) => {
        if (mutedAuthors[author]) {
          return prev;
        }
        if (
          blockedKeywords.some(
            (word) => word.trim().length > 0 && body.toLowerCase().includes(word.toLowerCase())
          )
        ) {
          return prev;
        }
        const msg: ChatMessage = {
          id: `chat-${Date.now()}-${Math.random()}`,
          author,
          body,
          at: Date.now()
        };
        return [msg, ...prev].slice(0, 40);
      });
    }, 6500);

    return () => {
      clearInterval(tick);
      clearInterval(autoChat);
    };
  }, [activeLiveStreamId, mutedAuthors, blockedKeywords]);

  React.useEffect(() => {
    if (activeTab !== "home") {
      setSelectedStreamId(null);
    }
  }, [activeTab]);

  React.useEffect(() => {
    if (!selectedStreamId) {
      return;
    }

    setViewerRoomChat((prev) => {
      if (prev[selectedStreamId]) {
        return prev;
      }
      return {
        ...prev,
        [selectedStreamId]: [
          { id: `vc-${Date.now()}-1`, author: "viewer_lina", body: "This looks amazing!", at: Date.now() },
          { id: `vc-${Date.now()}-2`, author: "viewer_omar", body: "How many left?", at: Date.now() }
        ]
      };
    });

    setViewerRoomLikes((prev) => {
      if (prev[selectedStreamId] !== undefined) {
        return prev;
      }
      return { ...prev, [selectedStreamId]: Math.floor(Math.random() * 900) + 120 };
    });

    const viewerCanned = [
      "Can you pin this item?",
      "I just reserved one.",
      "Price is great!",
      "Show size details please",
      "This will sell out fast"
    ];
    const viewerNames = ["viewer_noor", "viewer_sami", "viewer_maya", "viewer_huda", "viewer_ali"];
    const streamId = selectedStreamId;
    const chatter = setInterval(() => {
      setViewerRoomChat((prev) => {
        const room = prev[streamId] ?? [];
        const msg: ChatMessage = {
          id: `vc-${Date.now()}-${Math.random()}`,
          author: viewerNames[Math.floor(Math.random() * viewerNames.length)],
          body: viewerCanned[Math.floor(Math.random() * viewerCanned.length)],
          at: Date.now()
        };
        return { ...prev, [streamId]: [msg, ...room].slice(0, 30) };
      });
    }, 5200);

    const hearts = setInterval(() => {
      setViewerRoomLikes((prev) => ({
        ...prev,
        [streamId]: (prev[streamId] ?? 0) + Math.floor(Math.random() * 4)
      }));
    }, 1800);

    return () => {
      clearInterval(chatter);
      clearInterval(hearts);
    };
  }, [selectedStreamId]);

  const toggleFollow = (streamerId: string) => {
    runSmoothLayout();
    setFollowedStreamers((prev) => ({ ...prev, [streamerId]: !prev[streamerId] }));
  };

  const openStreamRoom = (streamId: string) => {
    runSmoothLayout();
    setStreams((prev) =>
      prev.map((stream) =>
        stream.id === streamId ? { ...stream, viewerCount: stream.viewerCount + 1 } : stream
      )
    );
    setSelectedStreamId(streamId);
  };

  const sendViewerComment = () => {
    if (!selectedStreamId || !viewerCommentInput.trim()) {
      return;
    }
    const streamId = selectedStreamId;
    const text = viewerCommentInput.trim();
    setViewerRoomChat((prev) => {
      const room = prev[streamId] ?? [];
      const msg: ChatMessage = { id: `vc-${Date.now()}-me`, author: "you", body: text, at: Date.now() };
      return { ...prev, [streamId]: [msg, ...room].slice(0, 30) };
    });
    setViewerCommentInput("");
  };

  const likeLiveRoom = () => {
    if (!selectedStreamId) {
      return;
    }
    setViewerRoomLikes((prev) => ({ ...prev, [selectedStreamId]: (prev[selectedStreamId] ?? 0) + 1 }));
  };

  const messageHasBlockedKeyword = React.useCallback(
    (body: string) =>
      blockedKeywords.some((word) => word.trim().length > 0 && body.toLowerCase().includes(word.toLowerCase())),
    [blockedKeywords]
  );

  const pushLiveChat = React.useCallback(
    (author: string, body: string) => {
      if (mutedAuthors[author]) {
        return;
      }
      if (messageHasBlockedKeyword(body)) {
        return;
      }
      setLiveChat((prev) => [{ id: `chat-${Date.now()}-${Math.random()}`, author, body, at: Date.now() }, ...prev].slice(0, 40));
    },
    [mutedAuthors, messageHasBlockedKeyword]
  );

  const toggleMuteAuthor = (author: string) => {
    setMutedAuthors((prev) => ({ ...prev, [author]: !prev[author] }));
  };

  const toggleHideMessage = (messageId: string) => {
    setHiddenChatIds((prev) => ({ ...prev, [messageId]: !prev[messageId] }));
  };

  const addBlockedKeyword = () => {
    const word = blockedKeywordInput.trim().toLowerCase();
    if (!word) {
      return;
    }
    setBlockedKeywords((prev) => (prev.includes(word) ? prev : [word, ...prev].slice(0, 8)));
    setBlockedKeywordInput("");
  };

  const reserveProduct = (stream: LiveStream, product: Product) => {
    const stock = getStock(stream.id, product.id);
    if (!product.inStock || stock <= 0) {
      Alert.alert("Sold out", "This item is no longer available in the live drop.");
      return;
    }
    if (reservedTokens + product.price > tokenBalance) {
      Alert.alert("Not enough Cat Coins", "Buy more Cat Coins from Profile to reserve this item.");
      return;
    }

    runSmoothLayout();
    setStockByKey((prev) => {
      const key = stockKey(stream.id, product.id);
      return { ...prev, [key]: Math.max((prev[key] ?? 0) - 1, 0) };
    });

    setReservations((prev) => {
      const existing = prev.find((line) => line.streamId === stream.id && line.product.id === product.id);
      if (existing) {
        return prev.map((line) =>
          line.id === existing.id
            ? { ...line, quantity: line.quantity + 1, reservedUntil: Date.now() + RESERVATION_WINDOW_MS }
            : line
        );
      }
      return [
        {
          id: `${stream.id}-${product.id}-${Date.now()}`,
          streamId: stream.id,
          product,
          quantity: 1,
          reservedUntil: Date.now() + RESERVATION_WINDOW_MS
        },
        ...prev
      ];
    });
    Alert.alert("Reserved", `${product.title} reserved for 10 minutes.`);
  };

  const changeReservationQuantity = (lineId: string, delta: number) => {
    runSmoothLayout();
    setReservations((prev) => {
      const target = prev.find((line) => line.id === lineId);
      if (!target) {
        return prev;
      }

      if (delta > 0) {
        const stock = getStock(target.streamId, target.product.id);
        if (stock <= 0) {
          Alert.alert("Sold out", "No more stock available for this item.");
          return prev;
        }
        const currentReserved = prev.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
        if (currentReserved + target.product.price > tokenBalance) {
          Alert.alert("Not enough Cat Coins", "Buy more Cat Coins to increase this reservation.");
          return prev;
        }
        setStockByKey((stockPrev) => {
          const key = stockKey(target.streamId, target.product.id);
          return { ...stockPrev, [key]: Math.max((stockPrev[key] ?? 0) - 1, 0) };
        });
      }

      const nextQty = target.quantity + delta;
      if (nextQty <= 0) {
        setStockByKey((stockPrev) => {
          const key = stockKey(target.streamId, target.product.id);
          return { ...stockPrev, [key]: (stockPrev[key] ?? 0) + target.quantity };
        });
        return prev.filter((line) => line.id !== lineId);
      }

      if (delta < 0) {
        setStockByKey((stockPrev) => {
          const key = stockKey(target.streamId, target.product.id);
          return { ...stockPrev, [key]: (stockPrev[key] ?? 0) + 1 };
        });
      }

      return prev.map((line) => (line.id === lineId ? { ...line, quantity: nextQty } : line));
    });
  };

  const releaseReservation = (lineId: string) => {
    runSmoothLayout();
    setReservations((prev) => {
      const target = prev.find((line) => line.id === lineId);
      if (!target) {
        return prev;
      }
      setStockByKey((stockPrev) => {
        const key = stockKey(target.streamId, target.product.id);
        return { ...stockPrev, [key]: (stockPrev[key] ?? 0) + target.quantity };
      });
      return prev.filter((line) => line.id !== lineId);
    });
  };

  const checkout = () => {
    if (reservations.length === 0) {
      Alert.alert("Cart is empty", "Reserve items from live streams first.");
      return;
    }
    if (reservedTokens > tokenBalance) {
      Alert.alert("Not enough Cat Coins", "Your wallet balance is below the reservation total.");
      return;
    }
    runSmoothLayout();
    const order: Order = {
      id: `order-${Date.now()}`,
      buyerName: deriveBuyerName(`order-${Date.now()}`),
      items: reservations,
      totalTokens: reservedTokens,
      createdAt: Date.now()
    };
    setOrders((prev) => [order, ...prev]);
    setTokenBalance((prev) => prev - reservedTokens);
    setReservations([]);
    Alert.alert("Purchase complete", `${reservedTokens} Cat Coins charged. Items are now yours.`);
  };

  const buyTokenPack = (amount: number) => {
    setTokenBalance((prev) => prev + amount);
    Alert.alert("Cat Coins added", `You received ${amount} Cat Coins.`);
  };

  const openTokenRecharge = (amount: number) => {
    runSmoothLayout();
    setSelectedRechargeTokens(amount);
    setUseCustomRecharge(false);
    setCustomRechargeInput("");
    setTokenRechargeVisible(true);
  };

  const submitTokenRecharge = () => {
    const rechargeTokens = useCustomRecharge ? customRechargeTokens : selectedRechargeTokens;
    if (useCustomRecharge && !customRechargeValid) {
      Alert.alert("Invalid custom amount", "Enter a custom amount between 100 and 5000 Cat Coins.");
      return;
    }

    if (!payEmail.includes("@")) {
      Alert.alert("Missing email", "Enter a valid receipt email.");
      return;
    }

    if (paymentMethod === "card") {
      if (!payName.trim()) {
        Alert.alert("Missing name", "Enter cardholder name.");
        return;
      }
      if (payCard.replace(/\s+/g, "").length < 12) {
        Alert.alert("Invalid card", "Enter a valid card number.");
        return;
      }
      if (payExpiry.trim().length < 4) {
        Alert.alert("Invalid expiry", "Enter card expiry.");
        return;
      }
      if (payCvv.trim().length < 3) {
        Alert.alert("Invalid CVV", "Enter card CVV.");
        return;
      }
    }

    setPaymentProcessing(true);
    setTimeout(() => {
      runSmoothLayout();
      setTokenBalance((prev) => prev + rechargeTokens);
      setPaymentProcessing(false);
      setTokenRechargeVisible(false);
      setUseCustomRecharge(false);
      setCustomRechargeInput("");
      setPayName("");
      setPayCard("");
      setPayExpiry("");
      setPayCvv("");
      setPayEmail("");
      Alert.alert("Recharge complete", `${rechargeTokens} Cat Coins added to your wallet.`);
    }, 900);
  };

  const toggleCameraFacing = () => {
    setCameraFacing((prev) => (prev === "front" ? "back" : "front"));
  };

  const resetNewItemDraft = () => {
    setNewItemName("");
    setNewItemDescription("");
    setNewItemPrice("120");
    setNewItemInventory("8");
    setNewItemPhotoUri(null);
  };

  const openItemCamera = async () => {
    if (!cameraPermission?.granted) {
      const permission = await requestCameraPermission();
      if (!permission.granted) {
        Alert.alert("Camera required", "Allow camera access to capture your item.");
        return;
      }
    }
    setItemCapturedPreviewUri(null);
    setItemCameraModalVisible(true);
  };

  const captureNewItemPhoto = async () => {
    if (!itemCameraRef.current) {
      Alert.alert("Camera not ready", "Wait a second, then try again.");
      return;
    }
    try {
      setCapturingItemPhoto(true);
      const result = await itemCameraRef.current.takePictureAsync({ quality: 0.8 });
      if (!result?.uri) {
        Alert.alert("Capture failed", "Could not capture item photo. Please try again.");
        return;
      }
      setItemCapturedPreviewUri(result.uri);
    } catch (_error) {
      Alert.alert("Capture failed", "Could not capture item photo. Please try again.");
    } finally {
      setCapturingItemPhoto(false);
    }
  };

  const confirmCapturedItemPhoto = () => {
    if (!itemCapturedPreviewUri) {
      return;
    }
    setNewItemPhotoUri(itemCapturedPreviewUri);
    setItemCapturedPreviewUri(null);
    setItemCameraModalVisible(false);
  };

  const closeItemCamera = () => {
    setItemCapturedPreviewUri(null);
    setItemCameraModalVisible(false);
    setCapturingItemPhoto(false);
  };

  const addCustomItemToDraft = () => {
    if (!newItemPhotoUri) {
      Alert.alert("Missing photo", "Capture a photo of the item first.");
      return;
    }
    const title = newItemName.trim();
    const description = newItemDescription.trim();
    const price = Math.floor(Number(newItemPrice));
    const inventory = Math.floor(Number(newItemInventory));

    if (!title) {
      Alert.alert("Missing item name", "Add a clear name for the item.");
      return;
    }
    if (!description) {
      Alert.alert("Missing description", "Add a short item description.");
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      Alert.alert("Invalid Cat Coins", "Set a valid Cat Coins price above 0.");
      return;
    }
    if (!Number.isFinite(inventory) || inventory <= 0) {
      Alert.alert("Invalid inventory", "Set inventory above 0.");
      return;
    }

    const idSeed = Date.now();
    const customProduct: Product = {
      id: `custom-${idSeed}`,
      title,
      description,
      price,
      currency: "TOKENS",
      imageUrl: newItemPhotoUri,
      inStock: true
    };

    setGoLiveDraftProducts((prev) => [
      {
        template: customProduct,
        selected: true,
        inventory
      },
      ...prev
    ]);
    resetNewItemDraft();
    Alert.alert("Item added", "New item added to your limited items list and selected for this live.");
  };

  const toggleDraftProduct = (productId: string) => {
    setGoLiveDraftProducts((prev) =>
      prev.map((entry) =>
        entry.template.id === productId ? { ...entry, selected: !entry.selected } : entry
      )
    );
  };

  const changeDraftInventory = (productId: string, delta: number) => {
    setGoLiveDraftProducts((prev) =>
      prev.map((entry) =>
        entry.template.id === productId
          ? { ...entry, inventory: Math.max(1, Math.min(50, entry.inventory + delta)) }
          : entry
      )
    );
  };

  const startGoLive = () => {
    if (!cameraPermission?.granted) {
      Alert.alert("Camera required", "Enable camera access before starting live.");
      return;
    }

    const selectedProducts = goLiveDraftProducts.filter((entry) => entry.selected);
    if (!streamTitle.trim()) {
      Alert.alert("Missing title", "Please provide a stream title.");
      return;
    }
    if (selectedProducts.length === 0) {
      Alert.alert("Add products", "Select at least one limited item for the stream.");
      return;
    }

    const seed = Date.now();
    const newStreamId = `stream-${seed}`;
    const newProducts: Product[] = selectedProducts.map((entry, idx) => ({
      ...entry.template,
      id: `${entry.template.id}-${seed}-${idx}`
    }));

    const newStream: LiveStream = {
      id: newStreamId,
      title: streamTitle.trim(),
      category: streamCategory,
      status: "live",
      viewerCount: 0,
      streamer: {
        id: "current-streamer",
        displayName,
        avatarUrl: profileAvatar
      },
      featuredProducts: newProducts
    };

    setStreams((prev) => [newStream, ...prev]);
    setStockByKey((prev) => {
      const next = { ...prev };
      selectedProducts.forEach((entry, idx) => {
        next[stockKey(newStreamId, newProducts[idx].id)] = entry.inventory;
      });
      return next;
    });
    setGoLiveDraftProducts((prev) => prev.map((entry) => ({ ...entry, selected: false, inventory: 8 })));
    setActiveLiveStreamId(newStreamId);
    setLiveStartedAt(Date.now());
    setLiveChat([]);
    setPinnedProductByStream((prev) => ({
      ...prev,
      [newStreamId]: newProducts[0]?.id ?? null
    }));
    setChatInput("");
    setActiveTab("goLive");
    pushLiveChat("system", "Live started successfully.");
    pushLiveChat("viewer_ali", "Let's go! show first item please");

    Alert.alert(
      "You are live",
      `${streamTitle} started with ${selectedProducts.length} limited items. Mic: ${
        micMuted ? "Muted" : "On"
      }, Replay: ${saveReplay ? "Save" : "Off"}.`
    );
  };

  const endLive = () => {
    if (!activeLiveStreamId) {
      return;
    }

    setStreams((prev) =>
      prev.map((stream) =>
        stream.id === activeLiveStreamId ? { ...stream, status: "ended", viewerCount: activeLiveViewerCount } : stream
      )
    );
    setLiveChat((prev) => [
      {
        id: `chat-${Date.now()}-end`,
        author: "system",
        body: "Live ended. Thanks for streaming.",
        at: Date.now()
      },
      ...prev
    ]);
    setActiveLiveStreamId(null);
    setLiveStartedAt(null);
    setLiveStatsTick(0);
  };

  const sendChatMessage = () => {
    if (!chatInput.trim()) {
      return;
    }
    pushLiveChat("host", chatInput.trim());
    setChatInput("");
  };

  const pinProduct = (productId: string) => {
    if (!activeLiveStreamId) {
      return;
    }
    setPinnedProductByStream((prev) => ({ ...prev, [activeLiveStreamId]: productId }));
    const productTitle =
      activeLiveStream?.featuredProducts.find((product) => product.id === productId)?.title ?? "Item";
    pushLiveChat("system", `Pinned product: ${productTitle}`);
  };

  const unpinProduct = () => {
    if (!activeLiveStreamId) {
      return;
    }
    setPinnedProductByStream((prev) => ({ ...prev, [activeLiveStreamId]: null }));
    pushLiveChat("system", "Pinned product cleared.");
  };

  const homeTabsOrder: HomeFeedTab[] = React.useMemo(() => ["explore", "following", "forYou"], []);
  const pinchStartDistanceRef = React.useRef<number | null>(null);
  const pinchTriggeredRef = React.useRef(false);
  const swipeResponder = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (event, gestureState) => {
          if (activeTab !== "home") {
            return false;
          }
          if (event.nativeEvent.touches.length >= 2) {
            return true;
          }
          return (
            Math.abs(gestureState.dx) > 18 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.2
          );
        },
        onPanResponderGrant: (event) => {
          if (event.nativeEvent.touches.length >= 2) {
            pinchStartDistanceRef.current = getTouchDistance(event.nativeEvent.touches);
            pinchTriggeredRef.current = false;
          } else {
            pinchStartDistanceRef.current = null;
          }
        },
        onPanResponderMove: (event) => {
          if (activeTab !== "home" || event.nativeEvent.touches.length < 2) {
            return;
          }
          if (!pinchStartDistanceRef.current || pinchTriggeredRef.current) {
            return;
          }
          const currentDistance = getTouchDistance(event.nativeEvent.touches);
          if (currentDistance <= 0) {
            return;
          }
          const scale = currentDistance / pinchStartDistanceRef.current;
          if (scale < 0.82) {
            pinchTriggeredRef.current = true;
            runSmoothLayout();
            setHomeFeedTab("explore");
          } else if (homeFeedTab === "explore" && scale > 1.14) {
            pinchTriggeredRef.current = true;
            runSmoothLayout();
            setHomeFeedTab("forYou");
          }
        },
        onPanResponderRelease: (_event, gestureState) => {
          pinchStartDistanceRef.current = null;
          pinchTriggeredRef.current = false;
          const currentIndex = homeTabsOrder.indexOf(homeFeedTab);
          if (gestureState.dx > 50 && currentIndex > 0) {
            setHomeFeedTab(homeTabsOrder[currentIndex - 1]);
          } else if (gestureState.dx < -50 && currentIndex < homeTabsOrder.length - 1) {
            setHomeFeedTab(homeTabsOrder[currentIndex + 1]);
          }
        },
        onPanResponderTerminate: () => {
          pinchStartDistanceRef.current = null;
          pinchTriggeredRef.current = false;
        }
      }),
    [activeTab, homeFeedTab, homeTabsOrder, runSmoothLayout]
  );

  const screenTransitionStyle = React.useMemo(
    () => ({
      opacity: screenTransition,
      transform: [
        {
          translateY: screenTransition.interpolate({
            inputRange: [0.88, 1],
            outputRange: [8, 0]
          })
        },
        {
          scale: screenTransition.interpolate({
            inputRange: [0.88, 1],
            outputRange: [0.995, 1]
          })
        }
      ]
    }),
    [screenTransition]
  );
  const liveDotScale = livePulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.35] });
  const liveDotOpacity = livePulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 0.28] });

  const renderFeedItem = ({ item }: { item: LiveStream }) => {
    const background = item.featuredProducts[0]?.imageUrl ?? item.streamer.avatarUrl;
    const following = isFollowing(item.streamer.id);

    return (
      <View style={styles.liveCard}>
        <View style={styles.liveCardHeader}>
          <View style={styles.hostSection}>
            <Image source={{ uri: item.streamer.avatarUrl }} style={styles.hostAvatar} />
            <View style={styles.hostMeta}>
              <Text style={styles.hostName}>{item.streamer.displayName}</Text>
              <Text style={styles.hostHandle}>@{item.streamer.displayName.replace(/\s+/g, "").toLowerCase()}</Text>
            </View>
          </View>
          <View style={styles.liveCardBadges}>
            <View style={styles.liveBadge}>
              <Animated.View
                style={[
                  styles.livePulseDot,
                  {
                    opacity: liveDotOpacity,
                    transform: [{ scale: liveDotScale }]
                  }
                ]}
              />
              <Text style={styles.liveBadgeText}>LIVE</Text>
            </View>
            <Text style={styles.viewerCount}>{item.viewerCount.toLocaleString()} watching</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.previewBox} onPress={() => openStreamRoom(item.id)}>
          <Image source={{ uri: background }} style={styles.previewImage} />
          <View style={styles.previewOverlay} />
          <View style={styles.previewFooter}>
            <Text style={styles.previewTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <TouchableOpacity style={styles.joinLiveBtn} onPress={() => openStreamRoom(item.id)}>
              <Text style={styles.joinLiveText}>Join Live</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>

        <Text style={styles.cardCategory}>{item.category}</Text>
        <Text style={styles.caption}>Limited products are reserved instantly for buyers with enough Cat Coins.</Text>

        <View style={styles.cardActionsRow}>
          <TouchableOpacity
            onPress={() => toggleFollow(item.streamer.id)}
            style={[styles.followButton, following ? styles.followingButton : styles.followCtaButton]}
          >
            <Text style={styles.followButtonText}>{following ? "Following" : "Follow Streamer"}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.liveProductsRow}>
          {item.featuredProducts.map((product) => {
            const stock = getStock(item.id, product.id);
            return (
              <TouchableOpacity key={product.id} style={styles.productMiniCard} onPress={() => reserveProduct(item, product)}>
                <Text style={styles.productMiniTitle} numberOfLines={1}>
                  {product.title}
                </Text>
                <Text style={styles.productMiniPrice}>{product.price} Cat Coins</Text>
                <Text style={[styles.stockText, stock <= 2 ? styles.lowStockText : null]}>
                  {stock > 0 ? `${stock} left` : "Sold out"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const renderExploreItem = ({ item }: { item: LiveStream }) => {
    const background = item.featuredProducts[0]?.imageUrl ?? item.streamer.avatarUrl;
    const following = isFollowing(item.streamer.id);

    return (
      <TouchableOpacity
        style={styles.exploreTile}
        onPress={() => openStreamRoom(item.id)}
        onLongPress={() =>
          Alert.alert(item.streamer.displayName, "Quick actions", [
            { text: "Join Live", onPress: () => openStreamRoom(item.id) },
            { text: following ? "Unfollow" : "Follow", onPress: () => toggleFollow(item.streamer.id) },
            { text: "Go To Profile", onPress: () => setActiveTab("profile") },
            { text: "Cancel", style: "cancel" }
          ])
        }
      >
        <Image source={{ uri: background }} style={styles.exploreTileImage} />
        <View style={styles.exploreTileOverlay} />
        <View style={styles.exploreLiveChip}>
          <View style={styles.exploreLiveDot} />
          <Text style={styles.exploreLiveText}>LIVE</Text>
        </View>
        <Text style={styles.exploreCategoryText}>{item.category}</Text>
      </TouchableOpacity>
    );
  };

  if (!authUser) {
    return (
      <SafeAreaView style={styles.authScreen}>
        <StatusBar style="light" />
        <View style={styles.authBackgroundOrbPrimary} />
        <View style={styles.authBackgroundOrbSecondary} />
        <ScrollView contentContainerStyle={styles.authContent}>
          <View style={styles.authHeader}>
            <AnimatedCatMascot />
            <Text style={styles.authBrandCn}>NINELIVE</Text>
            <Text style={styles.authTitle}>Welcome Back</Text>
            <Text style={styles.authSubtitle}>Join live shopping streams and reserve limited items in seconds.</Text>
          </View>

          <View style={styles.authCard}>
            {authMode === "welcome" ? (
              <View style={styles.authWelcomeOptions}>
                <TouchableOpacity
                  style={styles.authSocialButton}
                  onPress={() => handleSocialAuth("google")}
                  disabled={authProcessing}
                >
                  <Ionicons name="logo-google" size={18} color="#fff" />
                  <Text style={styles.authSocialButtonText}>Continue with Google</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.authSocialButton}
                  onPress={() => handleSocialAuth("icloud")}
                  disabled={authProcessing}
                >
                  <Ionicons name="logo-apple" size={18} color="#fff" />
                  <Text style={styles.authSocialButtonText}>Continue with iCloud</Text>
                </TouchableOpacity>

                <View style={styles.authDividerRow}>
                  <View style={styles.authDividerLine} />
                  <Text style={styles.authDividerText}>or</Text>
                  <View style={styles.authDividerLine} />
                </View>

                <TouchableOpacity style={styles.authPrimaryButton} onPress={() => setAuthMode("signin")}>
                  <Text style={styles.authPrimaryButtonText}>Sign In With Email</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.authSecondaryButton} onPress={() => setAuthMode("signup")}>
                  <Text style={styles.authSecondaryButtonText}>Create New Account</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {authMode === "signin" ? (
              <>
                <Text style={styles.authFormTitle}>Sign In</Text>
                <TextInput
                  style={styles.authInput}
                  value={authEmail}
                  onChangeText={setAuthEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="Email address"
                  placeholderTextColor="#8f8f8f"
                />
                <TextInput
                  style={styles.authInput}
                  value={authPassword}
                  onChangeText={setAuthPassword}
                  placeholder="Password"
                  placeholderTextColor="#8f8f8f"
                  secureTextEntry
                />
                <TouchableOpacity style={styles.authPrimaryButton} onPress={handleEmailSignIn} disabled={authProcessing}>
                  <Text style={styles.authPrimaryButtonText}>{authProcessing ? "Signing In..." : "Sign In"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.authSecondaryButton} onPress={() => setAuthMode("welcome")}>
                  <Text style={styles.authSecondaryButtonText}>Back</Text>
                </TouchableOpacity>
              </>
            ) : null}

            {authMode === "signup" ? (
              <>
                <Text style={styles.authFormTitle}>Create Account</Text>
                <TextInput
                  style={styles.authInput}
                  value={authName}
                  onChangeText={setAuthName}
                  placeholder="Full name"
                  placeholderTextColor="#8f8f8f"
                />
                <TextInput
                  style={styles.authInput}
                  value={authEmail}
                  onChangeText={setAuthEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="Email address"
                  placeholderTextColor="#8f8f8f"
                />
                <TextInput
                  style={styles.authInput}
                  value={authPassword}
                  onChangeText={setAuthPassword}
                  placeholder="Password (min 8 chars)"
                  placeholderTextColor="#8f8f8f"
                  secureTextEntry
                />
                <TextInput
                  style={styles.authInput}
                  value={authConfirmPassword}
                  onChangeText={setAuthConfirmPassword}
                  placeholder="Confirm password"
                  placeholderTextColor="#8f8f8f"
                  secureTextEntry
                />
                <TouchableOpacity
                  style={styles.authTermsRow}
                  onPress={() => setAuthAcceptedTerms((prev) => !prev)}
                >
                  <View style={[styles.authTermsCheck, authAcceptedTerms ? styles.authTermsCheckActive : null]}>
                    {authAcceptedTerms ? <Ionicons name="checkmark" size={12} color="#fff" /> : null}
                  </View>
                  <Text style={styles.authTermsText}>I agree to Terms and Privacy Policy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.authPrimaryButton} onPress={handleCreateAccount} disabled={authProcessing}>
                  <Text style={styles.authPrimaryButtonText}>{authProcessing ? "Creating..." : "Create Account"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.authSecondaryButton} onPress={() => setAuthMode("welcome")}>
                  <Text style={styles.authSecondaryButtonText}>Back</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (profileSetupNeeded) {
    return (
      <SafeAreaView style={styles.authScreen}>
        <StatusBar style="light" />
        <View style={styles.authBackgroundOrbPrimary} />
        <View style={styles.authBackgroundOrbSecondary} />
        <ScrollView contentContainerStyle={styles.authContent}>
          <View style={styles.authHeader}>
            <Text style={styles.authBrandCn}>NINELIVE</Text>
            <Text style={styles.authTitle}>Set Up Your Profile</Text>
            <Text style={styles.authSubtitle}>This info will be shown to viewers across the app.</Text>
          </View>

          <View style={styles.authCard}>
            <Text style={styles.authFormTitle}>Profile Photo</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.avatarOptionRow}>
              {profileAvatarOptions.map((avatarUrl) => (
                <TouchableOpacity
                  key={avatarUrl}
                  style={[
                    styles.avatarOptionButton,
                    profileAvatar === avatarUrl ? styles.avatarOptionButtonActive : null
                  ]}
                  onPress={() => setProfileAvatar(avatarUrl)}
                >
                  <Image source={{ uri: avatarUrl }} style={styles.avatarOptionImage} />
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TextInput
              style={styles.authInput}
              value={profileSetupAvatarUrl}
              onChangeText={setProfileSetupAvatarUrl}
              autoCapitalize="none"
              placeholder="Or paste image URL"
              placeholderTextColor="#8f8f8f"
            />
            <TouchableOpacity
              style={styles.authSecondaryButton}
              onPress={() => {
                if (!profileSetupAvatarUrl.trim().startsWith("http")) {
                  Alert.alert("Invalid URL", "Please enter a valid image URL.");
                  return;
                }
                setProfileAvatar(profileSetupAvatarUrl.trim());
              }}
            >
              <Text style={styles.authSecondaryButtonText}>Use URL Photo</Text>
            </TouchableOpacity>

            <Text style={styles.authFormTitle}>Public Details</Text>
            <TextInput
              style={styles.authInput}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Display name"
              placeholderTextColor="#8f8f8f"
            />
            <TextInput
              style={styles.authInput}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              placeholder="Username (e.g. nora_live)"
              placeholderTextColor="#8f8f8f"
            />
            <TextInput
              style={[styles.authInput, styles.authBioInput]}
              value={bio}
              onChangeText={setBio}
              placeholder="Short bio"
              placeholderTextColor="#8f8f8f"
              multiline
            />

            <TouchableOpacity style={styles.authPrimaryButton} onPress={completeProfileSetup}>
              <Text style={styles.authPrimaryButtonText}>Complete Setup</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <ThemeModeContext.Provider value={isDarkMode}>
    <SafeAreaView style={[styles.safeArea, { backgroundColor: ui.appBg }]}>
      <StatusBar style={isDarkMode ? "light" : "dark"} />

      {activeTab === "home" ? (
        <Animated.View style={[styles.feedSwipeContainer, screenTransitionStyle]} {...swipeResponder.panHandlers}>
          {!selectedStream ? (
            <View style={[styles.homeHeaderWrap, { backgroundColor: ui.appBg }]}>
              <View style={styles.topBar}>
                <Text style={[styles.brand, { color: ui.label }]}>NINELIVE</Text>
                <View style={styles.tabs}>
                  <View style={styles.feedTabRow}>
                    <TouchableOpacity onPress={() => setHomeFeedTab("explore")} style={styles.feedTabButton}>
                      <Text style={homeFeedTab === "explore" ? [styles.activeTab, !isDarkMode ? styles.activeTabLight : null] : [styles.inactiveTab, !isDarkMode ? styles.inactiveTabLight : null]}>Explore</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setHomeFeedTab("following")} style={styles.feedTabButton}>
                      <Text style={homeFeedTab === "following" ? [styles.activeTab, !isDarkMode ? styles.activeTabLight : null] : [styles.inactiveTab, !isDarkMode ? styles.inactiveTabLight : null]}>Following</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setHomeFeedTab("forYou")} style={styles.feedTabButton}>
                      <Text style={homeFeedTab === "forYou" ? [styles.activeTab, !isDarkMode ? styles.activeTabLight : null] : [styles.inactiveTab, !isDarkMode ? styles.inactiveTabLight : null]}>For You</Text>
                    </TouchableOpacity>
                  </View>
                  <View
                    style={[
                      styles.tabIndicator,
                      homeFeedTab === "explore"
                        ? styles.tabIndicatorExplore
                        : homeFeedTab === "forYou"
                          ? styles.tabIndicatorForYou
                          : styles.tabIndicatorFollowing
                    ]}
                  />
                </View>
                <TouchableOpacity style={[styles.searchBtn, { borderColor: ui.outline }]} onPress={() => setSearchModalVisible(true)}>
                  <Text style={[styles.searchLabel, { color: ui.label }]}>Search</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.tokenPill}>
                <CatCoinIcon size={15} />
                <Text style={styles.tokenPillText}>{tokenBalance} Cat Coins</Text>
              </View>
            </View>
          ) : null}
          <FlatList
            data={feedData}
            renderItem={homeFeedTab === "explore" ? renderExploreItem : renderFeedItem}
            keyExtractor={(item) => item.id}
            key={homeFeedTab === "explore" ? "explore-grid" : "home-feed"}
            numColumns={homeFeedTab === "explore" ? 2 : 1}
            decelerationRate="fast"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={homeFeedTab === "explore" ? styles.exploreGridContent : styles.feedContainer}
            ListEmptyComponent={
              homeFeedTab === "following" ? (
                <View style={[styles.emptyState, { height: cardHeight }]}>
                  <Text style={styles.emptyStateTitle}>No followed streamers yet</Text>
                  <Text style={styles.emptyStateText}>
                    Follow a streamer in For You, then swipe right to see them here.
                  </Text>
                  <TouchableOpacity style={styles.emptyStateButton} onPress={() => setHomeFeedTab("forYou")}>
                    <Text style={styles.emptyStateButtonText}>Back To For You</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={[styles.emptyState, { height: cardHeight }]}>
                  <Text style={styles.emptyStateTitle}>No livestreams match your filters</Text>
                  <Text style={styles.emptyStateText}>
                    Try another category or clear your search query.
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyStateButton}
                    onPress={() => {
                      setSearchQuery("");
                      setSelectedCategory("All");
                    }}
                  >
                    <Text style={styles.emptyStateButtonText}>Reset Filters</Text>
                  </TouchableOpacity>
                </View>
              )
            }
          />
        </Animated.View>
      ) : null}

      {activeTab === "goLive" ? (
        <Animated.View style={[styles.goLiveScreen, screenTransitionStyle, { backgroundColor: ui.sectionBg }]}>
        <SafeAreaView style={[styles.goLiveScreen, { backgroundColor: ui.sectionBg }]}>
          {activeLiveStream ? (
            <View style={styles.liveFullscreenRoot}>
              <CameraView style={styles.liveFullscreenCamera} facing={cameraFacing} />
              <View style={styles.liveFullscreenTopShade} />
              <View style={styles.liveFullscreenBottomShade} />

              <View style={styles.liveFullscreenTopBar}>
                <View style={styles.hostLiveBadge}>
                  <Animated.View
                    style={[
                      styles.livePulseDot,
                      {
                        opacity: liveDotOpacity,
                        transform: [{ scale: liveDotScale }]
                      }
                    ]}
                  />
                  <Text style={styles.hostLiveBadgeText}>LIVE</Text>
                  <Text style={styles.hostLiveViewerText}>{activeLiveViewerCount} watching</Text>
                </View>
                <View style={styles.hostLiveTopActions}>
                  <TouchableOpacity style={styles.hostTopIconBtn} onPress={() => setLiveOrdersVisible(true)}>
                    <Ionicons name="receipt-outline" size={20} color="#fff" />
                    {activeLiveOrderCount > 0 ? (
                      <View style={styles.hostTopIconBadge}>
                        <Text style={styles.hostTopIconBadgeText}>{activeLiveOrderCount > 99 ? "99+" : activeLiveOrderCount}</Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.hostTopIconBtn} onPress={() => setLiveSettingsVisible(true)}>
                    <Ionicons name="settings-outline" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>

              {pinnedProduct ? (
                <View style={styles.liveFullscreenPinned}>
                  <Text style={styles.pinnedBannerText}>Pinned: {pinnedProduct.title}</Text>
                </View>
              ) : null}

              <View style={styles.hostCommentsOverlay}>
                <ScrollView style={styles.hostCommentsList} showsVerticalScrollIndicator={false}>
                  {liveChat
                    .filter((msg) => !hiddenChatIds[msg.id])
                    .slice(0, 6)
                    .map((msg) => (
                      <View key={msg.id} style={styles.hostCommentItem}>
                        <Text style={styles.hostCommentAuthor}>{msg.author}</Text>
                        <Text style={styles.hostCommentBody}>{msg.body}</Text>
                      </View>
                    ))}
                </ScrollView>
                <View style={styles.hostCommentComposer}>
                  <TextInput
                    style={styles.hostCommentInput}
                    value={chatInput}
                    onChangeText={setChatInput}
                    placeholder="Reply in chat..."
                    placeholderTextColor="#8f8f8f"
                  />
                  <TouchableOpacity style={styles.hostCommentSend} onPress={sendChatMessage}>
                    <Text style={styles.hostCommentSendText}>Send</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Modal
                visible={liveOrdersVisible}
                animationType="slide"
                transparent
                onRequestClose={() => setLiveOrdersVisible(false)}
              >
                <View style={styles.searchOverlay}>
                  <Pressable style={styles.searchBackdrop} onPress={() => setLiveOrdersVisible(false)} />
                  <View style={[styles.searchSheet, { backgroundColor: surfaces.sheetBg }]}> 
                    <View style={styles.searchSheetHeader}>
                      <Text style={[styles.searchSheetTitle, { color: surfaces.title }]}> Live Orders</Text>
                      <TouchableOpacity onPress={() => setLiveOrdersVisible(false)}>
                        <Ionicons name="close" size={22} color="#fff" />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.liveOrdersStats}>
                      <StatTile label="Reserved" value={`${activeLiveReservedCount}`} />
                      <StatTile label="Pending Cat Coins" value={`${activeLiveReservedTokens}`} />
                      <StatTile label="Confirmed" value={`${activeLiveOrderCount}`} />
                      <StatTile label="Sold Cat Coins" value={`${activeLiveSoldTokens}`} />
                    </View>
                    <ScrollView style={styles.liveOrdersList} contentContainerStyle={styles.liveOrdersListContent}>
                      {activeLiveQueue.length === 0 ? (
                        <Text style={styles.emptyRecentText}>No queue activity yet.</Text>
                      ) : (
                        activeLiveQueue.map((entry) => (
                          <View key={entry.id} style={styles.queueItem}>
                            <View>
                              <Text style={styles.queueBuyer}>
                                {entry.buyerName} · {entry.type === "ordered" ? "Purchased" : "Reserved"}
                              </Text>
                              <Text style={styles.queueMeta}>
                                {entry.productTitle} x{entry.quantity}
                              </Text>
                            </View>
                            <View style={styles.queueRight}>
                              <Text style={styles.queueTokens}>{entry.tokens} Cat Coins</Text>
                              <Text style={styles.queueTime}>{new Date(entry.at).toLocaleTimeString()}</Text>
                            </View>
                          </View>
                        ))
                      )}
                    </ScrollView>
                  </View>
                </View>
              </Modal>

              <Modal
                visible={liveSettingsVisible}
                animationType="slide"
                transparent
                onRequestClose={() => setLiveSettingsVisible(false)}
              >
                <View style={styles.searchOverlay}>
                  <Pressable style={styles.searchBackdrop} onPress={() => setLiveSettingsVisible(false)} />
                  <View style={[styles.searchSheet, { backgroundColor: surfaces.sheetBg }]}> 
                    <View style={styles.searchSheetHeader}>
                      <Text style={[styles.searchSheetTitle, { color: surfaces.title }]}> Live Settings</Text>
                      <TouchableOpacity onPress={() => setLiveSettingsVisible(false)}>
                        <Ionicons name="close" size={22} color="#fff" />
                      </TouchableOpacity>
                    </View>
                    <ScrollView contentContainerStyle={styles.liveSettingsContent}>
                      <View style={styles.cameraControls}>
                        <TouchableOpacity style={styles.cameraControlBtn} onPress={toggleCameraFacing}>
                          <Ionicons name="camera-reverse-outline" size={18} color="#fff" />
                          <Text style={styles.cameraControlText}>Flip</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.cameraControlBtn} onPress={() => setMicMuted((prev) => !prev)}>
                          <Ionicons name={micMuted ? "mic-off-outline" : "mic-outline"} size={18} color="#fff" />
                          <Text style={styles.cameraControlText}>{micMuted ? "Muted" : "Mic On"}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.cameraControlBtn} onPress={() => setSaveReplay((prev) => !prev)}>
                          <Ionicons name={saveReplay ? "save-outline" : "save"} size={18} color="#fff" />
                          <Text style={styles.cameraControlText}>{saveReplay ? "Replay On" : "Replay Off"}</Text>
                        </TouchableOpacity>
                      </View>

                      <View style={[styles.profileCard, { backgroundColor: surfaces.cardBg, borderColor: surfaces.cardBorder }]}>
                        <Text style={styles.profileSectionTitle}>Pinned Product Controls</Text>
                        {activeLiveStream.featuredProducts.map((product) => {
                          const isPinned = pinnedProduct?.id === product.id;
                          return (
                            <View key={product.id} style={styles.pinRow}>
                              <View style={styles.pinMeta}>
                                <Text style={styles.pinTitle}>{product.title}</Text>
                                <Text style={styles.pinPrice}>{product.price} Cat Coins</Text>
                              </View>
                              <TouchableOpacity
                                style={[styles.pinButton, isPinned ? styles.pinButtonActive : null]}
                                onPress={() => pinProduct(product.id)}
                              >
                                <Text style={styles.pinButtonText}>{isPinned ? "Pinned" : "Pin"}</Text>
                              </TouchableOpacity>
                            </View>
                          );
                        })}
                        <TouchableOpacity style={styles.unpinButton} onPress={unpinProduct}>
                          <Text style={styles.unpinText}>Clear Pin</Text>
                        </TouchableOpacity>
                      </View>

                      <View style={[styles.profileCard, { backgroundColor: surfaces.cardBg, borderColor: surfaces.cardBorder }]}>
                        <Text style={styles.profileSectionTitle}>Moderation</Text>
                        <View style={styles.blockedRow}>
                          <TextInput
                            style={styles.blockedInput}
                            value={blockedKeywordInput}
                            onChangeText={setBlockedKeywordInput}
                            placeholder="Add blocked keyword"
                            placeholderTextColor="#8f8f8f"
                          />
                          <TouchableOpacity style={styles.blockedAddButton} onPress={addBlockedKeyword}>
                            <Text style={styles.blockedAddText}>Add</Text>
                          </TouchableOpacity>
                        </View>
                        <View style={styles.keywordWrap}>
                          {blockedKeywords.map((word) => (
                            <View key={word} style={styles.keywordChip}>
                              <Text style={styles.keywordChipText}>{word}</Text>
                            </View>
                          ))}
                        </View>
                        <View style={styles.chatList}>
                          {liveChat
                            .filter((msg) => !hiddenChatIds[msg.id])
                            .slice(0, 12)
                            .map((msg) => (
                              <View key={msg.id} style={styles.chatItem}>
                                <View style={styles.chatTopRow}>
                                  <Text style={styles.chatAuthor}>{msg.author}</Text>
                                  <View style={styles.chatActions}>
                                    <TouchableOpacity onPress={() => toggleMuteAuthor(msg.author)}>
                                      <Text style={styles.chatActionText}>
                                        {mutedAuthors[msg.author] ? "Unmute" : "Mute"}
                                      </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => toggleHideMessage(msg.id)}>
                                      <Text style={styles.chatActionText}>Hide</Text>
                                    </TouchableOpacity>
                                  </View>
                                </View>
                                <Text style={styles.chatBody}>{msg.body}</Text>
                              </View>
                            ))}
                        </View>
                      </View>

                      <TouchableOpacity style={styles.endLiveButton} onPress={endLive}>
                        <Text style={styles.endLiveText}>End Live</Text>
                      </TouchableOpacity>
                    </ScrollView>
                  </View>
                </View>
              </Modal>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.goLiveContent}>
              <Text style={styles.goLiveHeader}>Go Live Studio</Text>
              <Text style={styles.goLiveSubheader}>Create limited drops, then broadcast instantly.</Text>

              <View style={styles.cameraStage}>
                {cameraPermission?.granted ? (
                  <CameraView style={styles.cameraPreview} facing={cameraFacing} />
                ) : (
                  <View style={styles.permissionCard}>
                    <Ionicons name="videocam-outline" size={36} color="#ff8cab" />
                    <Text style={styles.permissionTitle}>Enable Camera</Text>
                    <Text style={styles.permissionText}>
                      Ninelive needs camera access so streamers can broadcast live.
                    </Text>
                    <TouchableOpacity style={styles.permissionButton} onPress={() => requestCameraPermission()}>
                      <Text style={styles.permissionButtonText}>Allow Camera</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.cameraControls}>
                  <TouchableOpacity style={styles.cameraControlBtn} onPress={toggleCameraFacing}>
                    <Ionicons name="camera-reverse-outline" size={18} color="#fff" />
                    <Text style={styles.cameraControlText}>Flip</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cameraControlBtn} onPress={openItemCamera}>
                    <Ionicons name="camera-outline" size={18} color="#fff" />
                    <Text style={styles.cameraControlText}>Item Cam</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cameraControlBtn} onPress={() => setMicMuted((prev) => !prev)}>
                    <Ionicons name={micMuted ? "mic-off-outline" : "mic-outline"} size={18} color="#fff" />
                    <Text style={styles.cameraControlText}>{micMuted ? "Muted" : "Mic On"}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.formCard}>
                <Text style={styles.inputLabel}>Stream title</Text>
                <TextInput
                  style={styles.textInput}
                  value={streamTitle}
                  onChangeText={setStreamTitle}
                  placeholder="What are you selling now?"
                  placeholderTextColor="#8f8f8f"
                />

                <Text style={styles.inputLabel}>Category</Text>
                <View style={styles.categoryRow}>
                  {["Fashion", "Beauty", "Home", "Tech"].map((category) => (
                    <TouchableOpacity
                      key={category}
                      style={[styles.categoryChip, streamCategory === category ? styles.categoryChipActive : null]}
                      onPress={() => setStreamCategory(category)}
                    >
                      <Text style={styles.categoryChipText}>{category}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.inputLabel}>Create New Item</Text>
                <View style={styles.customItemCard}>
                  {newItemPhotoUri ? (
                    <Image source={{ uri: newItemPhotoUri }} style={styles.customItemPhoto} />
                  ) : (
                    <View style={styles.customItemPhotoPlaceholder}>
                      <Ionicons name="camera-outline" size={20} color="#ffd0da" />
                      <Text style={styles.customItemPlaceholderText}>Tap Snap Item to capture product photo</Text>
                    </View>
                  )}
                  <View style={styles.customItemActionsRow}>
                    <TouchableOpacity style={styles.customItemCaptureButton} onPress={openItemCamera}>
                      <Text style={styles.customItemCaptureText}>{newItemPhotoUri ? "Retake Photo" : "Take Photo"}</Text>
                    </TouchableOpacity>
                    {newItemPhotoUri ? (
                      <TouchableOpacity style={styles.customItemClearButton} onPress={resetNewItemDraft}>
                        <Text style={styles.customItemClearText}>Clear</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <TextInput
                    style={styles.textInput}
                    value={newItemName}
                    onChangeText={setNewItemName}
                    placeholder="Item name"
                    placeholderTextColor="#8f8f8f"
                  />
                  <TextInput
                    style={[styles.textInput, styles.customItemDescriptionInput]}
                    value={newItemDescription}
                    onChangeText={setNewItemDescription}
                    placeholder="Item description"
                    placeholderTextColor="#8f8f8f"
                    multiline
                  />
                  <View style={styles.customItemFieldsRow}>
                    <TextInput
                      style={[styles.textInput, styles.customItemField]}
                      value={newItemPrice}
                      onChangeText={setNewItemPrice}
                      placeholder="Cat Coins"
                      keyboardType="number-pad"
                      placeholderTextColor="#8f8f8f"
                    />
                    <TextInput
                      style={[styles.textInput, styles.customItemField]}
                      value={newItemInventory}
                      onChangeText={setNewItemInventory}
                      placeholder="Stock"
                      keyboardType="number-pad"
                      placeholderTextColor="#8f8f8f"
                    />
                  </View>
                  <TouchableOpacity style={styles.customItemAddButton} onPress={addCustomItemToDraft}>
                    <Text style={styles.customItemAddText}>Add Item To Stream</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.inputLabel}>Limited Items Setup</Text>
                <View style={styles.productsGrid}>
                  {goLiveDraftProducts.map((entry) => (
                    <View
                      key={entry.template.id}
                      style={[styles.goLiveProductCard, entry.selected ? styles.goLiveProductSelected : null]}
                    >
                      <TouchableOpacity style={styles.goLiveProductMain} onPress={() => toggleDraftProduct(entry.template.id)}>
                        <Image source={{ uri: entry.template.imageUrl }} style={styles.goLiveProductImage} />
                        <View style={styles.goLiveProductMeta}>
                          <Text style={styles.goLiveProductTitle} numberOfLines={1}>
                            {entry.template.title}
                          </Text>
                          {entry.template.description ? (
                            <Text style={styles.goLiveProductDescription} numberOfLines={2}>
                              {entry.template.description}
                            </Text>
                          ) : null}
                          <Text style={styles.goLiveProductPrice}>{entry.template.price} Cat Coins</Text>
                        </View>
                        <View style={[styles.selectDot, entry.selected ? styles.selectDotActive : null]} />
                      </TouchableOpacity>

                      {entry.selected ? (
                        <View style={styles.inventoryRow}>
                          <Text style={styles.inventoryLabel}>Limited stock</Text>
                          <View style={styles.qtyInline}>
                            <TouchableOpacity
                              style={styles.qtyButton}
                              onPress={() => changeDraftInventory(entry.template.id, -1)}
                            >
                              <Text style={styles.qtyButtonText}>-</Text>
                            </TouchableOpacity>
                            <Text style={styles.qtyValue}>{entry.inventory}</Text>
                            <TouchableOpacity
                              style={styles.qtyButton}
                              onPress={() => changeDraftInventory(entry.template.id, 1)}
                            >
                              <Text style={styles.qtyButtonText}>+</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : null}
                    </View>
                  ))}
                </View>

                <TouchableOpacity style={styles.switchRow} onPress={() => setSaveReplay((prev) => !prev)}>
                  <View>
                    <Text style={styles.switchTitle}>Save replay</Text>
                    <Text style={styles.switchText}>Viewers can shop from replay after live ends.</Text>
                  </View>
                  <View style={[styles.switchPill, saveReplay ? styles.switchPillActive : null]}>
                    <View style={[styles.switchDot, saveReplay ? styles.switchDotActive : null]} />
                  </View>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.goLiveButton} onPress={startGoLive}>
                <Text style={styles.goLiveButtonText}>Start Live</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </SafeAreaView>
        </Animated.View>
      ) : null}

      {activeTab === "cart" ? (
        <Animated.View style={[styles.cartScreen, screenTransitionStyle, { backgroundColor: ui.sectionBg }]}>
        <SafeAreaView style={[styles.cartScreen, { backgroundColor: ui.sectionBg }]}>
          <ScrollView contentContainerStyle={styles.cartContent}>
            <Text style={[styles.cartHeader, { color: surfaces.title }]}>Reserved Cart</Text>
            <Text style={[styles.cartSubheader, { color: surfaces.body }]}>Reserved items are locked for 10 minutes before release.</Text>

            <View style={[styles.cartWalletCard, { backgroundColor: surfaces.cardBg, borderColor: surfaces.cardBorder }]}>
              <View style={styles.cartWalletRow}>
                <Text style={styles.cartWalletLabel}>Wallet</Text>
                <Text style={styles.cartWalletValue}>{tokenBalance} Cat Coins</Text>
              </View>
              <View style={styles.cartWalletRow}>
                <Text style={styles.cartWalletLabel}>Reserved</Text>
                <Text style={styles.cartWalletValue}>{reservedTokens} Cat Coins</Text>
              </View>
              <View style={styles.cartWalletRow}>
                <Text style={styles.cartWalletLabel}>Available</Text>
                <Text style={styles.cartWalletValue}>{availableTokens} Cat Coins</Text>
              </View>
            </View>

            {reservations.length === 0 ? (
              <View style={[styles.cartEmptyCard, { backgroundColor: surfaces.cardBg, borderColor: surfaces.cardBorder }]}>
                <Text style={[styles.cartEmptyTitle, { color: surfaces.title }]}>No reserved items</Text>
                <Text style={styles.cartEmptyText}>Reserve live products first, then checkout here.</Text>
                <TouchableOpacity style={styles.emptyStateButton} onPress={() => setActiveTab("home")}>
                  <Text style={styles.emptyStateButtonText}>Go To Home</Text>
                </TouchableOpacity>
              </View>
            ) : (
              reservations.map((line) => {
                const stream = streamById[line.streamId];
                return (
                  <View key={line.id} style={[styles.cartItemCard, { backgroundColor: surfaces.cardBg, borderColor: surfaces.cardBorder }]}>
                    <Image source={{ uri: line.product.imageUrl }} style={styles.cartItemImage} />
                    <View style={styles.cartItemMeta}>
                      <Text style={styles.cartItemTitle} numberOfLines={1}>
                        {line.product.title}
                      </Text>
                      <Text style={styles.cartItemPrice}>{line.product.price} Cat Coins each</Text>
                      <Text style={styles.cartItemSubtotal}>{line.product.price * line.quantity} Cat Coins total</Text>
                      <Text style={styles.cartItemStream}>{stream?.title ?? "Live stream"}</Text>
                      <Text style={styles.countdownText}>
                        Reserved: {formatCountdown(line.reservedUntil - Date.now())}
                      </Text>
                    </View>
                    <View style={styles.qtyColumn}>
                      <TouchableOpacity style={styles.qtyButton} onPress={() => changeReservationQuantity(line.id, 1)}>
                        <Text style={styles.qtyButtonText}>+</Text>
                      </TouchableOpacity>
                      <Text style={styles.qtyValue}>{line.quantity}</Text>
                      <TouchableOpacity style={styles.qtyButton} onPress={() => changeReservationQuantity(line.id, -1)}>
                        <Text style={styles.qtyButtonText}>-</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.releaseButton} onPress={() => releaseReservation(line.id)}>
                        <Text style={styles.releaseText}>Release</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}

            <TouchableOpacity style={styles.goLiveButton} onPress={checkout}>
              <Text style={styles.goLiveButtonText}>Checkout ({reservedTokens} Cat Coins)</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
        </Animated.View>
      ) : null}

      {activeTab === "profile" ? (
        <Animated.View style={[styles.profileTabScreen, screenTransitionStyle, { backgroundColor: ui.sectionBg }]}>
        <SafeAreaView style={[styles.profileTabScreen, { backgroundColor: ui.sectionBg }]}>
          <ScrollView contentContainerStyle={styles.profileTabContent}>
            <View style={[styles.profileHero, { backgroundColor: surfaces.cardBg, borderColor: surfaces.cardBorder }]}>
              <Image source={{ uri: profileAvatar }} style={styles.profileHeroAvatar} />
              <Text style={[styles.profileHeroName, { color: surfaces.title }]}>{displayName}</Text>
              <Text style={[styles.profileHeroHandle, { color: isDarkMode ? "#9fcfff" : "#2f6ea7" }]}>@{username}</Text>
              <Text style={[styles.profileHeroBio, { color: surfaces.body }]}>{bio}</Text>
              <TouchableOpacity
                style={styles.profileSignOutButton}
                onPress={() => {
                  setAuthUser(null);
                  setProfileSetupNeeded(false);
                  setAuthMode("welcome");
                }}
              >
                <Text style={styles.profileSignOutText}>Sign Out</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.walletCard, { backgroundColor: surfaces.cardBg, borderColor: surfaces.cardBorder }]}>
              <View style={styles.walletHeader}>
                <View style={styles.walletTitleRow}>
                  <CatCoinIcon size={18} />
                  <Text style={[styles.walletTitle, { color: surfaces.title }]}>Cat Coins Wallet</Text>
                </View>
                <Text style={styles.walletBalance}>{tokenBalance} Cat Coins</Text>
              </View>
              <Text style={[styles.walletSubtext, { color: surfaces.body }]}>Buy Cat Coins packs and use them to reserve live items instantly.</Text>
              <View style={styles.tokenPackRow}>
                <TouchableOpacity style={styles.tokenPackButton} onPress={() => openTokenRecharge(300)}>
                  <Text style={styles.tokenPackLabel}>+300 • $4.99</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.tokenPackButton} onPress={() => openTokenRecharge(800)}>
                  <Text style={styles.tokenPackLabel}>+800 • $11.99</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.tokenPackButton} onPress={() => openTokenRecharge(1500)}>
                  <Text style={styles.tokenPackLabel}>+1500 • $19.99</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.walletRechargeButton} onPress={() => openTokenRecharge(selectedRechargeTokens)}>
                <Text style={styles.walletRechargeButtonText}>Recharge With Payment</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.profileStatsGrid}>
              <StatTile label="Following" value={`${Object.values(followedStreamers).filter(Boolean).length}`} />
              <StatTile label="Reserved" value={`${cartCount}`} />
              <StatTile label="Orders" value={`${orders.length}`} />
              <StatTile label="Spent" value={`${totalSpentTokens} Cat Coins`} />
            </View>

            <View style={[styles.profileCard, { backgroundColor: surfaces.cardBg, borderColor: surfaces.cardBorder }]}>
              <Text style={[styles.profileSectionTitle, { color: surfaces.title }]}>Edit Profile</Text>
              <Text style={[styles.inputLabel, { color: surfaces.title }]}>Display name</Text>
              <TextInput style={[styles.textInput, { backgroundColor: surfaces.inputBg, borderColor: surfaces.inputBorder, color: surfaces.inputText }]} value={displayName} onChangeText={setDisplayName} />
              <Text style={[styles.inputLabel, { color: surfaces.title }]}>Bio</Text>
              <TextInput style={[styles.textInput, styles.bioInput, { backgroundColor: surfaces.inputBg, borderColor: surfaces.inputBorder, color: surfaces.inputText }]} value={bio} onChangeText={setBio} multiline />
            </View>

            <View style={[styles.profileCard, { backgroundColor: surfaces.cardBg, borderColor: surfaces.cardBorder }]}>
              <Text style={[styles.profileSectionTitle, { color: surfaces.title }]}>Notifications</Text>
              <SettingRow
                title="Push alerts"
                subtitle="Live reminders and reservation expiry alerts"
                enabled={pushAlerts}
                onToggle={() => setPushAlerts((prev) => !prev)}
              />
              <SettingRow
                title="Email alerts"
                subtitle="Order receipts and weekly token reports"
                enabled={emailAlerts}
                onToggle={() => setEmailAlerts((prev) => !prev)}
              />
            </View>

            <View style={[styles.profileCard, { backgroundColor: surfaces.cardBg, borderColor: surfaces.cardBorder }]}>
              <Text style={[styles.profileSectionTitle, { color: surfaces.title }]}>App Appearance</Text>
              <View style={styles.appearanceRow}>
                <TouchableOpacity
                  style={[styles.appearanceChip, appearanceMode === "system" ? styles.appearanceChipActive : null]}
                  onPress={() => setAppearanceMode("system")}
                >
                  <Text style={[styles.appearanceChipText, !isDarkMode ? { color: "#111" } : null]}>Same As System</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.appearanceChip, appearanceMode === "light" ? styles.appearanceChipActive : null]}
                  onPress={() => setAppearanceMode("light")}
                >
                  <Text style={[styles.appearanceChipText, !isDarkMode ? { color: "#111" } : null]}>Light</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.appearanceChip, appearanceMode === "dark" ? styles.appearanceChipActive : null]}
                  onPress={() => setAppearanceMode("dark")}
                >
                  <Text style={[styles.appearanceChipText, !isDarkMode ? { color: "#111" } : null]}>Dark</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.appearanceHint, { color: surfaces.body }]}>
                {appearanceMode === "system"
                  ? "Following your device appearance."
                  : `Using ${appearanceMode} mode.`}
              </Text>
            </View>

            <View style={[styles.profileCard, { backgroundColor: surfaces.cardBg, borderColor: surfaces.cardBorder }]}>
              <Text style={[styles.profileSectionTitle, { color: surfaces.title }]}>Recent Orders</Text>
              {orders.length === 0 ? (
                <Text style={[styles.emptyRecentText, { color: surfaces.body }]}>No orders yet. Checkout from Cart to see history.</Text>
              ) : (
                orders.slice(0, 4).map((order) => (
                  <View key={order.id} style={styles.orderRow}>
                    <View>
                      <Text style={[styles.orderTitle, { color: surfaces.title }]}>{new Date(order.createdAt).toLocaleString()}</Text>
                      <Text style={[styles.orderMeta, { color: surfaces.body }]}>
                        {order.items.reduce((sum, item) => sum + item.quantity, 0)} items
                      </Text>
                    </View>
                    <Text style={styles.orderTokens}>{order.totalTokens} Cat Coins</Text>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
        </Animated.View>
      ) : null}

      <Modal
        visible={tokenRechargeVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setTokenRechargeVisible(false)}
      >
        <View style={styles.searchOverlay}>
          <Pressable style={styles.searchBackdrop} onPress={() => setTokenRechargeVisible(false)} />
          <View style={[styles.searchSheet, { backgroundColor: surfaces.sheetBg }]}>
            <View style={styles.searchSheetHeader}>
              <Text style={[styles.searchSheetTitle, { color: surfaces.title }]}>Recharge Cat Coins</Text>
              <TouchableOpacity onPress={() => setTokenRechargeVisible(false)}>
                <Ionicons name="close" size={22} color={surfaces.title} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.paymentSectionLabel, { color: surfaces.title }]}> Choose package</Text>
            <View style={styles.paymentPackWrap}>
              {rechargePackages.map((pack) => (
                <TouchableOpacity
                  key={pack.tokens}
                  style={[styles.paymentPackCard, selectedRechargeTokens === pack.tokens ? styles.paymentPackCardActive : null]}
                  onPress={() => {
                    setSelectedRechargeTokens(pack.tokens);
                    setUseCustomRecharge(false);
                  }}
                >
                  <Text style={styles.paymentPackBadge}>{pack.badge}</Text>
                  <Text style={[styles.paymentPackTokens, !isDarkMode ? { color: "#111" } : null]}> {pack.tokens} Cat Coins</Text>
                  <Text style={styles.paymentPackPrice}>${pack.usd.toFixed(2)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.paymentBestOfferHint, { color: surfaces.body }]}> 
              Packages are best offers. Custom amount uses flexible pricing with a service fee.
            </Text>

            <View style={styles.customRechargeCard}>
              <View style={styles.customRechargeHeader}>
                <Text style={[styles.customRechargeTitle, { color: surfaces.title }]}> Need a different amount?</Text>
                <TouchableOpacity
                  style={[styles.paymentMethodChip, useCustomRecharge ? styles.paymentMethodChipActive : null]}
                  onPress={() => setUseCustomRecharge((prev) => !prev)}
                >
                  <Text style={[styles.paymentMethodText, !isDarkMode ? { color: "#111" } : null]}> {useCustomRecharge ? "Using Custom" : "Use Custom"}</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={[styles.searchInput, { backgroundColor: surfaces.inputBg, borderColor: surfaces.inputBorder, color: surfaces.inputText }]}
                value={customRechargeInput}
                onChangeText={(value) => {
                  setCustomRechargeInput(value.replace(/[^0-9]/g, ""));
                  setUseCustomRecharge(true);
                }}
                keyboardType="number-pad"
                placeholder="Custom Cat Coins (100 - 5000)"
                placeholderTextColor="#8f8f8f"
              />
              <Text style={[styles.customRechargeFormula, { color: surfaces.body }]}> 
                Formula: (Cat Coins × $0.0185) + $0.99 fee
              </Text>
              <Text style={[styles.customRechargeTotal, { color: surfaces.title }]}> 
                {useCustomRecharge && customRechargeValid
                  ? `Custom charge: $${customRechargeTotal.toFixed(2)}`
                  : `Selected package: $${activePackage.usd.toFixed(2)}`}
              </Text>
            </View>

            <Text style={[styles.paymentSectionLabel, { color: surfaces.title }]}> Payment method</Text>
            <View style={styles.paymentMethodRow}>
              <TouchableOpacity
                style={[styles.paymentMethodChip, paymentMethod === "card" ? styles.paymentMethodChipActive : null]}
                onPress={() => setPaymentMethod("card")}
              >
                <Text style={[styles.paymentMethodText, !isDarkMode ? { color: "#111" } : null]}> Card</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.paymentMethodChip, paymentMethod === "apple" ? styles.paymentMethodChipActive : null]}
                onPress={() => setPaymentMethod("apple")}
              >
                <Text style={[styles.paymentMethodText, !isDarkMode ? { color: "#111" } : null]}> Apple Pay</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.paymentMethodChip, paymentMethod === "google" ? styles.paymentMethodChipActive : null]}
                onPress={() => setPaymentMethod("google")}
              >
                <Text style={[styles.paymentMethodText, !isDarkMode ? { color: "#111" } : null]}> Google Pay</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.searchInput, { backgroundColor: surfaces.inputBg, borderColor: surfaces.inputBorder, color: surfaces.inputText }]}
              value={payEmail}
              onChangeText={setPayEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="Receipt email"
              placeholderTextColor="#8f8f8f"
            />

            {paymentMethod === "card" ? (
              <>
                <TextInput
                  style={[styles.searchInput, { backgroundColor: surfaces.inputBg, borderColor: surfaces.inputBorder, color: surfaces.inputText }]}
                  value={payName}
                  onChangeText={setPayName}
                  placeholder="Cardholder name"
                  placeholderTextColor="#8f8f8f"
                />
                <TextInput
                  style={[styles.searchInput, { backgroundColor: surfaces.inputBg, borderColor: surfaces.inputBorder, color: surfaces.inputText }]}
                  value={payCard}
                  onChangeText={setPayCard}
                  keyboardType="number-pad"
                  placeholder="Card number"
                  placeholderTextColor="#8f8f8f"
                />
                <View style={styles.paymentCardRow}>
                  <TextInput
                    style={[styles.searchInput, styles.paymentCardHalf, { backgroundColor: surfaces.inputBg, borderColor: surfaces.inputBorder, color: surfaces.inputText }]}
                    value={payExpiry}
                    onChangeText={setPayExpiry}
                    placeholder="MM/YY"
                    placeholderTextColor="#8f8f8f"
                  />
                  <TextInput
                    style={[styles.searchInput, styles.paymentCardHalf, { backgroundColor: surfaces.inputBg, borderColor: surfaces.inputBorder, color: surfaces.inputText }]}
                    value={payCvv}
                    onChangeText={setPayCvv}
                    keyboardType="number-pad"
                    placeholder="CVV"
                    placeholderTextColor="#8f8f8f"
                  />
                </View>
              </>
            ) : (
              <View style={styles.paymentWalletHint}>
                <Text style={styles.paymentWalletHintText}>
                  You will confirm this purchase with {paymentMethod === "apple" ? "Apple Pay" : "Google Pay"}.
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.searchApplyBtn, paymentProcessing ? styles.paymentDisabledBtn : null]}
              onPress={submitTokenRecharge}
              disabled={paymentProcessing}
            >
              <Text style={styles.searchApplyText}>
                {paymentProcessing
                  ? "Processing..."
                  : `Pay ${useCustomRecharge && customRechargeValid ? `$${customRechargeTotal.toFixed(2)}` : `$${activePackage.usd.toFixed(2)}`} & Recharge ${
                      useCustomRecharge && customRechargeValid ? customRechargeTokens : selectedRechargeTokens
                    } Cat Coins`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={itemCameraModalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeItemCamera}
      >
        <View style={styles.itemCameraOverlay}>
          <View style={styles.itemCameraShell}>
            {itemCapturedPreviewUri ? (
              <Image source={{ uri: itemCapturedPreviewUri }} style={styles.itemCameraPreviewImage} />
            ) : (
              <CameraView ref={itemCameraRef} style={styles.itemCameraPreview} facing={itemCameraFacing} />
            )}

            <View style={styles.itemCameraTopBar}>
              <TouchableOpacity style={styles.itemCameraTopBtn} onPress={closeItemCamera}>
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
              {!itemCapturedPreviewUri ? (
                <TouchableOpacity
                  style={styles.itemCameraTopBtn}
                  onPress={() => setItemCameraFacing((prev) => (prev === "front" ? "back" : "front"))}
                >
                  <Ionicons name="camera-reverse-outline" size={20} color="#fff" />
                </TouchableOpacity>
              ) : <View style={styles.itemCameraTopBtnPlaceholder} />}
            </View>

            <View style={styles.itemCameraBottomBar}>
              {itemCapturedPreviewUri ? (
                <View style={styles.itemCameraReviewActions}>
                  <TouchableOpacity
                    style={[styles.itemCameraActionBtn, styles.itemCameraRetakeBtn]}
                    onPress={() => setItemCapturedPreviewUri(null)}
                  >
                    <Text style={styles.itemCameraActionText}>Retake</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.itemCameraActionBtn, styles.itemCameraUseBtn]}
                    onPress={confirmCapturedItemPhoto}
                  >
                    <Text style={styles.itemCameraActionText}>Use Photo</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.itemCameraCaptureBtn}
                  onPress={captureNewItemPhoto}
                  disabled={capturingItemPhoto}
                >
                  <View style={styles.itemCameraCaptureInner} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={searchModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSearchModalVisible(false)}
      >
        <View style={styles.searchOverlay}>
          <Pressable style={styles.searchBackdrop} onPress={() => setSearchModalVisible(false)} />
          <View style={[styles.searchSheet, { backgroundColor: surfaces.sheetBg }]}> 
            <View style={styles.searchSheetHeader}>
              <Text style={[styles.searchSheetTitle, { color: surfaces.title }]}> Search Livestreams</Text>
              <TouchableOpacity onPress={() => setSearchModalVisible(false)}>
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.searchInput, { backgroundColor: surfaces.inputBg, borderColor: surfaces.inputBorder, color: surfaces.inputText }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by stream, streamer, or category"
              placeholderTextColor="#8f8f8f"
            />
            <Text style={styles.searchHint}>Categories</Text>
            <View style={styles.searchCategoryWrap}>
              {categoryOptions.map((category) => (
                <TouchableOpacity
                  key={category}
                  style={[styles.searchCategoryChip, selectedCategory === category ? styles.searchCategoryChipActive : null]}
                  onPress={() => setSelectedCategory(category)}
                >
                  <Text style={styles.searchCategoryChipText}>{category}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.searchActions}>
              <TouchableOpacity
                style={styles.searchClearBtn}
                onPress={() => {
                  setSearchQuery("");
                  setSelectedCategory("All");
                }}
              >
                <Text style={styles.searchClearText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.searchApplyBtn} onPress={() => setSearchModalVisible(false)}>
                <Text style={styles.searchApplyText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(selectedStream)}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          setSelectedStreamId(null);
        }}
      >
        <View style={styles.roomOverlay}>
          <View style={styles.roomSheet}>
            {selectedStream ? (
              <>
                <Image
                  source={{ uri: selectedStream.featuredProducts[0]?.imageUrl ?? selectedStream.streamer.avatarUrl }}
                  style={styles.roomStreamerImage}
                />
                <View style={styles.roomNotchCover} />
                <View style={styles.roomShadeTop} />
                <View style={styles.roomShadeBottom} />

                <View style={styles.roomTopOverlay}>
                  <View style={styles.roomTopLeftBlock}>
                    <View style={styles.roomStreamerTopRow}>
                      <Image source={{ uri: selectedStream.streamer.avatarUrl }} style={styles.roomHostAvatar} />
                      <View style={styles.roomHostMeta}>
                        <Text style={styles.roomTitle}>{selectedStream.streamer.displayName}</Text>
                        <Text style={styles.roomSubTitle}>{selectedStream.title}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.roomFollowBtn}
                        onPress={() => toggleFollow(selectedStream.streamer.id)}
                      >
                        <Text style={styles.roomFollowText}>
                          {isFollowing(selectedStream.streamer.id) ? "Following" : "Follow"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.roomMiniLiveBadge}>
                      <Animated.View
                        style={[
                          styles.livePulseDot,
                          {
                            opacity: liveDotOpacity,
                            transform: [{ scale: liveDotScale }]
                          }
                        ]}
                      />
                      <Text style={styles.viewerLiveLabel}>LIVE</Text>
                      <Text style={styles.roomMiniViewerText}>{selectedStream.viewerCount.toLocaleString()} watching</Text>
                    </View>
                  </View>
                  <View style={styles.roomTopActions}>
                    <TouchableOpacity
                      style={styles.roomTopIconButton}
                      onPress={() => {
                        setSelectedStreamId(null);
                      }}
                    >
                      <Ionicons name="close" size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.roomRightRail}>
                  <View style={styles.viewerLiveLabelWrap}>
                    <Text style={styles.viewerLiveLabel}>LIVE</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.viewerLikeButton}
                    onPress={likeLiveRoom}
                  >
                    <Ionicons name="heart" size={22} color="#ff7798" />
                    <Text style={styles.viewerLikeCount}>
                      {(viewerRoomLikes[selectedStream.id] ?? 0).toLocaleString()}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.roomRailButton}
                    onPress={() => {
                      setSelectedStreamId(null);
                      setActiveTab("profile");
                    }}
                  >
                    <Ionicons name="person-circle-outline" size={24} color="#fff" />
                    <Text style={styles.roomRailText}>Profile</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.roomRailButton}
                    onPress={() => {
                      setSelectedStreamId(null);
                      setActiveTab("cart");
                    }}
                  >
                    <Ionicons name="cart-outline" size={23} color="#fff" />
                    <Text style={styles.roomRailText}>Cart</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.roomBottomOverlay}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.roomProducts}
                  >
                    {selectedStream.featuredProducts.map((product) => {
                      const stock = getStock(selectedStream.id, product.id);
                      return (
                        <TouchableOpacity
                          key={product.id}
                          style={styles.roomProductCard}
                          onPress={() => reserveProduct(selectedStream, product)}
                        >
                          <Image source={{ uri: product.imageUrl }} style={styles.roomProductImage} />
                          <View style={styles.roomProductMeta}>
                            <Text style={styles.roomProductTitle} numberOfLines={1}>
                              {product.title}
                            </Text>
                            <Text style={styles.roomProductPrice}>{product.price} Cat Coins</Text>
                            <Text style={[styles.stockText, stock <= 2 ? styles.lowStockText : null]}>
                              {stock > 0 ? `${stock} left` : "Sold out"}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  <View style={styles.viewerCommentsCard}>
                    <ScrollView
                      style={styles.viewerCommentsList}
                      showsVerticalScrollIndicator={false}
                    >
                      {(viewerRoomChat[selectedStream.id] ?? []).slice(0, 5).map((msg) => (
                        <View key={msg.id} style={styles.viewerCommentItem}>
                          <Text style={styles.viewerCommentAuthor}>{msg.author}</Text>
                          <Text style={styles.viewerCommentBody}>{msg.body}</Text>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                  <View style={styles.viewerCommentComposer}>
                    <TextInput
                      style={styles.viewerCommentInput}
                      value={viewerCommentInput}
                      onChangeText={setViewerCommentInput}
                      placeholder="Write a comment..."
                      placeholderTextColor="#8f8f8f"
                    />
                    <TouchableOpacity
                      style={styles.viewerCommentSend}
                      onPress={sendViewerComment}
                    >
                      <Text style={styles.viewerCommentSendText}>Send</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      {!selectedStream ? (
        <View style={[styles.tabBar, { backgroundColor: ui.tabBg, borderColor: ui.tabBorder }]}>
          <TabButton
          label="Home"
          active={activeTab === "home"}
          activeColor={isDarkMode ? "#ffffff" : "#111111"}
          inactiveColor={ui.subLabel}
          icon={activeTab === "home" ? "home" : "home-outline"}
          onPress={() => setActiveTab("home")}
        />
          <TabButton
          label="Go Live"
          active={activeTab === "goLive"}
          activeColor="#ff7f9f"
          inactiveColor={ui.subLabel}
          icon={activeTab === "goLive" ? "radio" : "radio-outline"}
          onPress={() => setActiveTab("goLive")}
        />
          <TabButton
          label={cartCount > 0 ? `Cart ${cartCount}` : "Cart"}
          active={activeTab === "cart"}
          activeColor="#ffd27d"
          inactiveColor={ui.subLabel}
          icon={activeTab === "cart" ? "cart" : "cart-outline"}
          onPress={() => setActiveTab("cart")}
        />
          <TabButton
          label="Profile"
          active={activeTab === "profile"}
          activeColor="#8fc9ff"
          inactiveColor={ui.subLabel}
          icon={activeTab === "profile" ? "person" : "person-outline"}
          onPress={() => setActiveTab("profile")}
        />
        </View>
      ) : null}
    </SafeAreaView>
    </ThemeModeContext.Provider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#050505" },
  authScreen: { flex: 1, backgroundColor: "#050505" },
  authBackgroundOrbPrimary: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(255,45,85,0.2)",
    top: -40,
    right: -60
  },
  authBackgroundOrbSecondary: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(80,180,255,0.14)",
    bottom: -80,
    left: -70
  },
  authContent: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 44 },
  authHeader: { marginTop: 14, marginBottom: 18 },
  authBrandCn: {
    marginTop: 8,
    color: "#f7e7c8",
    fontSize: 24,
    letterSpacing: 3.2,
    textAlign: "center",
    fontWeight: "800",
    fontFamily: Platform.select({
      ios: "Hiragino Sans W6",
      android: "serif",
      default: "serif"
    })
  },
  authTitle: { marginTop: 10, color: "#fff", fontSize: 33, fontWeight: "900", textAlign: "center" },
  authSubtitle: { marginTop: 8, color: "#cfcfcf", fontSize: 14, lineHeight: 20, textAlign: "center" },
  catWrap: { width: 188, alignSelf: "center", alignItems: "center" },
  catHead: {
    width: 110,
    height: 92,
    borderRadius: 48,
    backgroundColor: "#101010",
    alignItems: "center",
    justifyContent: "center",
    position: "relative"
  },
  catEar: {
    width: 0,
    height: 0,
    borderLeftWidth: 13,
    borderRightWidth: 13,
    borderBottomWidth: 22,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#101010",
    position: "absolute",
    top: -16
  },
  catEarLeft: { left: 11, transform: [{ rotate: "-18deg" }] },
  catEarRight: { right: 11, transform: [{ rotate: "18deg" }] },
  catEarInner: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 12,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#de7a33",
    position: "absolute",
    top: -9
  },
  catEarInnerLeft: { left: 15, transform: [{ rotate: "-18deg" }] },
  catEarInnerRight: { right: 15, transform: [{ rotate: "18deg" }] },
  catEyeRow: { flexDirection: "row", gap: 14, marginTop: -10 },
  catEye: {
    width: 23,
    height: 18,
    borderRadius: 10,
    backgroundColor: "#87ef60",
    alignItems: "center",
    justifyContent: "center"
  },
  catEyeInner: { width: 15, height: 12, borderRadius: 7, backgroundColor: "#59c53f", position: "absolute" },
  catPupil: { width: 5, height: 11, borderRadius: 4, backgroundColor: "#111" },
  catEyeSpark: { position: "absolute", top: 3, right: 5, width: 4, height: 4, borderRadius: 2, backgroundColor: "#fff" },
  catMuzzle: {
    position: "absolute",
    top: 56,
    width: 34,
    height: 18,
    borderRadius: 10,
    backgroundColor: "#f5f5f5"
  },
  catNose: {
    marginTop: 8,
    width: 8,
    height: 6,
    borderRadius: 4,
    backgroundColor: "#2a2a2a"
  },
  catMouthLine: {
    marginTop: 2,
    width: 2,
    height: 7,
    backgroundColor: "#2f2f2f",
    borderRadius: 2
  },
  catWhiskerLeftTop: { position: "absolute", left: 10, top: 59, width: 22, height: 1.5, backgroundColor: "#d8d8d8", transform: [{ rotate: "-9deg" }] },
  catWhiskerLeftBottom: { position: "absolute", left: 10, top: 67, width: 22, height: 1.5, backgroundColor: "#d8d8d8", transform: [{ rotate: "6deg" }] },
  catWhiskerRightTop: { position: "absolute", right: 10, top: 59, width: 22, height: 1.5, backgroundColor: "#d8d8d8", transform: [{ rotate: "9deg" }] },
  catWhiskerRightBottom: { position: "absolute", right: 10, top: 67, width: 22, height: 1.5, backgroundColor: "#d8d8d8", transform: [{ rotate: "-6deg" }] },
  catBody: {
    marginTop: -3,
    width: 120,
    height: 104,
    borderRadius: 58,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center"
  },
  catBelly: { width: 52, height: 58, borderRadius: 26, backgroundColor: "#f5f5f5", marginTop: 10 },
  catCollar: {
    position: "absolute",
    top: 20,
    width: 106,
    height: 10,
    borderRadius: 8,
    backgroundColor: "#d6252a"
  },
  catBell: {
    position: "absolute",
    top: 26,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#ffdd45",
    borderWidth: 1,
    borderColor: "#e5ba16"
  },
  catLegRow: { position: "absolute", bottom: 7, flexDirection: "row", gap: 12 },
  catLeg: { width: 22, height: 26, borderRadius: 11, backgroundColor: "#0f0f0f", justifyContent: "flex-end", alignItems: "center" },
  catPaw: { width: 18, height: 10, borderRadius: 5, backgroundColor: "#f5f5f5", marginBottom: 1 },
  catTail: {
    position: "absolute",
    right: 8,
    bottom: 18,
    width: 64,
    height: 13,
    borderRadius: 7,
    backgroundColor: "#101010",
    justifyContent: "flex-end"
  },
  catTailTip: { width: 16, height: 13, borderRadius: 7, backgroundColor: "#f5f5f5", alignSelf: "flex-end" },
  authCard: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 18,
    backgroundColor: "rgba(18,18,18,0.94)",
    padding: 14,
    gap: 10,
    width: "100%",
    maxWidth: 430,
    alignSelf: "center"
  },
  authWelcomeOptions: { width: "100%", alignItems: "center", gap: 10 },
  authSocialButton: {
    width: "100%",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "#1c1c1c",
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  authSocialButtonText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  authDividerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 2 },
  authDividerLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.14)" },
  authDividerText: { color: "#a8a8a8", fontSize: 11, fontWeight: "700" },
  authPrimaryButton: {
    width: "100%",
    borderRadius: 12,
    backgroundColor: "#ff2d55",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12
  },
  authPrimaryButtonText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  authSecondaryButton: {
    width: "100%",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11
  },
  authSecondaryButtonText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  authFormTitle: { color: "#fff", fontSize: 17, fontWeight: "900", marginBottom: 3 },
  authInput: {
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "#1d1d1d",
    color: "#fff",
    fontSize: 13,
    paddingHorizontal: 11,
    paddingVertical: 10
  },
  authBioInput: { minHeight: 80, textAlignVertical: "top" },
  avatarOptionRow: { gap: 9, paddingVertical: 6 },
  avatarOptionButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.18)",
    overflow: "hidden"
  },
  avatarOptionButtonActive: { borderColor: "#ff2d55" },
  avatarOptionImage: { width: "100%", height: "100%" },
  authTermsRow: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 2 },
  authTermsCheck: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1d1d1d"
  },
  authTermsCheckActive: { backgroundColor: "#ff2d55", borderColor: "#ff2d55" },
  authTermsText: { color: "#c4c4c4", fontSize: 11, flex: 1 },
  slide: { width: "100%", marginBottom: 14, borderRadius: 22, overflow: "hidden" },
  feedSwipeContainer: { flex: 1 },
  feedContainer: { paddingTop: 10, paddingBottom: 120 },
  background: { flex: 1 },
  bgImage: { resizeMode: "cover" },
  darkOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0, 0, 0, 0.34)" },
  bottomFade: { position: "absolute", left: 0, right: 0, bottom: 0, height: "45%", backgroundColor: "rgba(0,0,0,0.55)" },
  overlay: { flex: 1, justifyContent: "space-between" },
  topBar: { paddingHorizontal: 16, paddingTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { color: "#f9f6ef", fontSize: 12, fontWeight: "900", letterSpacing: 1.4 },
  tabs: { alignItems: "center", gap: 5 },
  feedTabRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  feedTabButton: { paddingVertical: 2 },
  inactiveTab: { color: "rgba(255,255,255,0.6)", fontSize: 15, fontWeight: "600" },
  inactiveTabLight: { color: "rgba(0,0,0,0.5)" },
  activeTab: { color: "#ffffff", fontSize: 16, fontWeight: "800" },
  activeTabLight: { color: "#111111" },
  tabIndicator: { width: 28, height: 3, borderRadius: 999, backgroundColor: "#ff2d55" },
  tabIndicatorExplore: { marginLeft: -86 },
  tabIndicatorFollowing: { marginLeft: 0 },
  tabIndicatorForYou: { marginLeft: 86 },
  exploreGridContent: { paddingTop: 10, paddingBottom: 120, paddingHorizontal: 10, gap: 10 },
  exploreTile: {
    width: "48%",
    aspectRatio: 1,
    marginHorizontal: "1%",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "#131313"
  },
  exploreTileImage: { width: "100%", height: "100%" },
  exploreTileOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.28)" },
  exploreLiveChip: {
    position: "absolute",
    top: 8,
    left: 8,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.58)",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 4
  },
  exploreLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#ff2d55" },
  exploreLiveText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  exploreCategoryText: {
    position: "absolute",
    left: 8,
    bottom: 8,
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
    backgroundColor: "rgba(0,0,0,0.56)",
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 999
  },
  searchBtn: { borderWidth: 1, borderColor: "rgba(255,255,255,0.35)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  searchLabel: { color: "#ffffff", fontSize: 12, fontWeight: "700" },
  tokenPill: { marginTop: 8, marginHorizontal: 16, alignSelf: "flex-end", backgroundColor: "rgba(0,0,0,0.45)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, flexDirection: "row", alignItems: "center", gap: 6 },
  tokenPillText: { color: "#ffe08f", fontSize: 12, fontWeight: "800" },
  catCoinBase: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#e0a826",
    borderWidth: 1,
    borderColor: "#8e6300",
    shadowColor: "#f8d778",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 2
  },
  catCoinShine: {
    position: "absolute",
    width: "55%",
    height: "32%",
    borderRadius: 999,
    top: "12%",
    left: "16%",
    backgroundColor: "rgba(255,255,255,0.35)"
  },
  catCoinInnerRing: {
    borderWidth: 1,
    borderColor: "rgba(125,83,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f2c041"
  },
  catCoinHead: {
    borderWidth: 1,
    borderColor: "rgba(90,58,0,0.7)",
    backgroundColor: "rgba(244,208,110,0.25)",
    justifyContent: "center",
    alignItems: "center"
  },
  catCoinEarLeft: {
    position: "absolute",
    width: 5,
    height: 5,
    left: -1,
    top: -3,
    backgroundColor: "#d8a734",
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: "rgba(90,58,0,0.7)",
    transform: [{ rotate: "-35deg" }]
  },
  catCoinEarRight: {
    position: "absolute",
    width: 5,
    height: 5,
    right: -1,
    top: -3,
    backgroundColor: "#d8a734",
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderColor: "rgba(90,58,0,0.7)",
    transform: [{ rotate: "35deg" }]
  },
  homeHeaderWrap: {
    paddingTop: 6,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)"
  },
  liveCard: {
    backgroundColor: "#131313",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 16,
    marginHorizontal: 12,
    marginBottom: 12,
    padding: 12
  },
  liveCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  hostSection: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1
  },
  hostAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21
  },
  hostMeta: {
    marginLeft: 10
  },
  hostName: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800"
  },
  hostHandle: {
    color: "#bbbbbb",
    fontSize: 11,
    marginTop: 2
  },
  liveCardBadges: {
    alignItems: "flex-end"
  },
  previewBox: {
    marginTop: 10,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)"
  },
  previewImage: {
    width: "100%",
    height: 190
  },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.28)"
  },
  previewFooter: {
    position: "absolute",
    bottom: 8,
    left: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  previewTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
    maxWidth: "65%"
  },
  joinLiveBtn: {
    backgroundColor: "#ff2d55",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  joinLiveText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800"
  },
  cardCategory: {
    color: "#ffdba8",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 10
  },
  cardActionsRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  quickActionChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  quickActionChipText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700"
  },
  liveProductsRow: {
    marginTop: 10,
    gap: 8,
    paddingRight: 6
  },
  productMiniCard: {
    width: 170,
    borderRadius: 10,
    backgroundColor: "#1d1d1d",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.13)",
    padding: 10
  },
  productMiniTitle: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700"
  },
  productMiniPrice: {
    color: "#ffd7a1",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 5
  },
  categoryStrip: { paddingHorizontal: 12, paddingTop: 8, gap: 8 },
  categoryFilterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(0,0,0,0.35)",
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  categoryFilterChipActive: {
    backgroundColor: "rgba(255,45,85,0.28)",
    borderColor: "#ff2d55"
  },
  categoryFilterChipText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  contentRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingHorizontal: 14, paddingBottom: 96 },
  leftPanel: { flex: 1, paddingRight: 10 },
  liveBadge: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10, gap: 7 },
  livePulseDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#ff2d55" },
  liveBadgeText: { color: "#ffffff", backgroundColor: "#ff2d55", overflow: "hidden", borderRadius: 8, fontSize: 11, fontWeight: "800", paddingHorizontal: 6, paddingVertical: 2 },
  viewerCount: { color: "#ffffff", fontSize: 12, fontWeight: "700" },
  streamerRow: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  handle: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
  enterRoomLink: { color: "#ffe08f", fontSize: 12, fontWeight: "700" },
  title: { color: "#ffffff", marginTop: 6, fontSize: 22, fontWeight: "900", lineHeight: 26 },
  caption: { color: "rgba(255,255,255,0.9)", marginTop: 8, fontSize: 13, lineHeight: 18, maxWidth: "90%" },
  followButton: { marginTop: 10, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, alignSelf: "flex-start" },
  followCtaButton: { backgroundColor: "#ff2d55" },
  followingButton: { backgroundColor: "rgba(255,255,255,0.22)", borderWidth: 1, borderColor: "rgba(255,255,255,0.4)" },
  followButtonText: { color: "#ffffff", fontSize: 12, fontWeight: "800" },
  productStrip: { paddingTop: 12, gap: 8, paddingRight: 6 },
  productCard: { width: 200, borderRadius: 12, overflow: "hidden", backgroundColor: "rgba(20,20,20,0.88)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  productImage: { width: "100%", height: 90 },
  productMeta: { paddingHorizontal: 10, paddingVertical: 8 },
  productTitle: { color: "#ffffff", fontSize: 12, fontWeight: "700" },
  productPrice: { color: "#ffd7a1", fontSize: 12, fontWeight: "700", marginTop: 4 },
  stockText: { color: "#caf6b7", fontSize: 11, marginTop: 3, fontWeight: "700" },
  lowStockText: { color: "#ff9fa8" },
  actionsRail: { width: 78, alignItems: "center", gap: 10 },
  avatarWrap: { alignItems: "center" },
  avatar: { width: 52, height: 52, borderRadius: 26, borderWidth: 1.5, borderColor: "#ffffff" },
  plusDot: { position: "absolute", bottom: -8, backgroundColor: "#ff2d55", width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  plusDotFollowing: { backgroundColor: "#13ad67" },
  plusText: { color: "#ffffff", fontSize: 10, fontWeight: "900" },
  actionItem: { alignItems: "center", gap: 4 },
  actionCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)" },
  actionIcon: { color: "#ffffff", fontSize: 15, fontWeight: "800" },
  actionValue: { color: "#ffffff", fontSize: 11, fontWeight: "700" },
  emptyState: { borderRadius: 22, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "#131313", marginBottom: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  emptyStateTitle: { color: "#ffffff", fontSize: 22, fontWeight: "900", textAlign: "center" },
  emptyStateText: { color: "#bdbdbd", fontSize: 14, textAlign: "center", lineHeight: 20, marginTop: 10 },
  emptyStateButton: { marginTop: 16, backgroundColor: "#ff2d55", borderRadius: 999, paddingVertical: 10, paddingHorizontal: 18 },
  emptyStateButtonText: { color: "#ffffff", fontSize: 13, fontWeight: "800" },
  goLiveScreen: { flex: 1, backgroundColor: "#080808" },
  goLiveContent: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 110, gap: 12 },
  goLiveHeader: { color: "#ffffff", fontSize: 26, fontWeight: "900" },
  goLiveSubheader: { color: "#bdbdbd", fontSize: 14 },
  liveFullscreenRoot: { flex: 1, backgroundColor: "#000" },
  liveFullscreenCamera: { ...StyleSheet.absoluteFillObject },
  liveFullscreenTopShade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 170,
    backgroundColor: "rgba(0,0,0,0.45)"
  },
  liveFullscreenBottomShade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 430,
    backgroundColor: "rgba(0,0,0,0.56)"
  },
  liveFullscreenTopBar: {
    paddingTop: 52,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10
  },
  hostLiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(0,0,0,0.56)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  hostLiveBadgeText: {
    color: "#fff",
    backgroundColor: "#ff2d55",
    borderRadius: 8,
    overflow: "hidden",
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 10,
    fontWeight: "800"
  },
  hostLiveViewerText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  hostLiveTopActions: { flexDirection: "row", gap: 8 },
  hostTopIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)"
  },
  hostTopIconBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#ff2d55",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.75)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4
  },
  hostTopIconBadgeText: { color: "#fff", fontSize: 9, fontWeight: "900" },
  liveFullscreenMeta: {
    flex: 1
  },
  liveFullscreenTitle: { color: "#fff", fontSize: 17, fontWeight: "900" },
  liveFullscreenSubtitle: { color: "#f2f2f2", fontSize: 12, marginTop: 4 },
  liveFullscreenPinned: {
    position: "absolute",
    top: 108,
    left: 12,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.66)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  hostCommentsOverlay: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 98
  },
  hostCommentsList: {
    maxHeight: 170
  },
  hostCommentItem: {
    marginBottom: 7,
    backgroundColor: "rgba(0,0,0,0.34)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "flex-start",
    maxWidth: "88%"
  },
  hostCommentAuthor: { color: "#ffd0da", fontSize: 10, fontWeight: "700" },
  hostCommentBody: { color: "#fff", fontSize: 11, marginTop: 2 },
  hostCommentComposer: { marginTop: 8, flexDirection: "row", gap: 8 },
  hostCommentInput: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.48)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 10,
    color: "#fff",
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  hostCommentSend: {
    backgroundColor: "#ff2d55",
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: "center"
  },
  hostCommentSendText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  liveFullscreenRightRail: {
    position: "absolute",
    right: 10,
    top: 142,
    alignItems: "center",
    gap: 10
  },
  liveRailButton: {
    width: 58,
    minHeight: 60,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(0,0,0,0.46)",
    alignItems: "center",
    justifyContent: "center",
    gap: 4
  },
  liveRailText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  liveRailStat: {
    width: 58,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(0,0,0,0.46)",
    alignItems: "center",
    paddingVertical: 8
  },
  liveRailStatValue: { color: "#fff", fontSize: 15, fontWeight: "900" },
  liveRailStatLabel: { color: "#ddd", fontSize: 10, marginTop: 2 },
  liveControlsSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "64%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: "rgba(8,8,8,0.94)",
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.16)"
  },
  liveSheetHandle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.35)",
    marginTop: 8
  },
  liveControlsContent: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 120, gap: 12 },
  liveOrdersStats: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  liveOrdersList: { marginTop: 10, maxHeight: 420 },
  liveOrdersListContent: { paddingBottom: 8 },
  liveSettingsContent: { gap: 10, paddingTop: 8, paddingBottom: 12 },
  liveControlHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  endLiveButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,130,150,0.55)",
    backgroundColor: "rgba(255,55,95,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  endLiveText: { color: "#ff97ae", fontSize: 12, fontWeight: "800" },
  livePreviewCard: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)"
  },
  livePreview: {
    height: 190
  },
  livePreviewOverlay: {
    position: "absolute",
    top: 8,
    left: 8,
    right: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  livePillText: {
    color: "#fff",
    backgroundColor: "#ff2d55",
    borderRadius: 10,
    overflow: "hidden",
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 10,
    fontWeight: "800"
  },
  livePillViewers: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700"
  },
  pinnedBanner: {
    backgroundColor: "rgba(0,0,0,0.62)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  pinnedBannerText: {
    color: "#ffe3a8",
    fontSize: 11,
    fontWeight: "700"
  },
  liveStatGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  salesLine: { color: "#cfcfcf", fontSize: 13, marginTop: 5 },
  pinRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "#1d1d1d",
    borderRadius: 10,
    padding: 10
  },
  pinMeta: {
    flex: 1,
    paddingRight: 8
  },
  pinTitle: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700"
  },
  pinPrice: {
    color: "#ffc990",
    fontSize: 12,
    marginTop: 4
  },
  pinButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  pinButtonActive: {
    backgroundColor: "rgba(255,45,85,0.22)",
    borderColor: "#ff2d55"
  },
  pinButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700"
  },
  unpinButton: {
    alignSelf: "flex-end",
    marginTop: 2
  },
  unpinText: {
    color: "#ff9fb4",
    fontSize: 12,
    fontWeight: "700"
  },
  queueItem: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 10,
    backgroundColor: "#1d1d1d",
    padding: 10,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  queueBuyer: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700"
  },
  queueMeta: {
    color: "#b9b9b9",
    fontSize: 11,
    marginTop: 4
  },
  queueRight: {
    alignItems: "flex-end"
  },
  queueTokens: {
    color: "#ffe08f",
    fontSize: 12,
    fontWeight: "800"
  },
  queueTime: {
    color: "#a4a4a4",
    fontSize: 10,
    marginTop: 4
  },
  chatComposer: { flexDirection: "row", gap: 8, marginBottom: 10 },
  chatInput: {
    flex: 1,
    backgroundColor: "#1d1d1d",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 12,
    color: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14
  },
  chatSendButton: {
    borderRadius: 12,
    backgroundColor: "#ff2d55",
    paddingHorizontal: 12,
    justifyContent: "center"
  },
  chatSendText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  moderationPanel: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 10,
    backgroundColor: "#1d1d1d",
    padding: 10,
    marginBottom: 10
  },
  modHeader: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800"
  },
  blockedRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8
  },
  blockedInput: {
    flex: 1,
    backgroundColor: "#232323",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    color: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12
  },
  blockedAddButton: {
    backgroundColor: "rgba(255,45,85,0.2)",
    borderWidth: 1,
    borderColor: "#ff2d55",
    borderRadius: 8,
    justifyContent: "center",
    paddingHorizontal: 10
  },
  blockedAddText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700"
  },
  keywordWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8
  },
  keywordChip: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4
  },
  keywordChipText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700"
  },
  chatList: { gap: 8 },
  chatItem: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 10,
    backgroundColor: "#1d1d1d",
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  chatTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  chatActions: {
    flexDirection: "row",
    gap: 10
  },
  chatActionText: {
    color: "#9fd1ff",
    fontSize: 11,
    fontWeight: "700"
  },
  chatAuthor: { color: "#ffd0da", fontSize: 11, fontWeight: "700" },
  chatBody: { color: "#fff", fontSize: 12, marginTop: 3 },
  cameraStage: { borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", backgroundColor: "#101010" },
  cameraPreview: { height: 270 },
  permissionCard: { height: 270, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  permissionTitle: { color: "#ffffff", fontSize: 20, fontWeight: "900", marginTop: 10 },
  permissionText: { color: "#c7c7c7", textAlign: "center", lineHeight: 20, marginTop: 8 },
  permissionButton: { marginTop: 16, backgroundColor: "#ff2d55", borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 },
  permissionButtonText: { color: "#ffffff", fontWeight: "800", fontSize: 13 },
  cameraControls: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 10, paddingVertical: 9, backgroundColor: "rgba(0,0,0,0.65)" },
  cameraControlBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.22)", borderRadius: 999, paddingVertical: 7, paddingHorizontal: 10 },
  cameraControlText: { color: "#ffffff", fontSize: 12, fontWeight: "700" },
  formCard: { backgroundColor: "#141414", borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.09)", padding: 14 },
  inputLabel: { color: "#f2f2f2", fontSize: 13, fontWeight: "700", marginBottom: 8 },
  textInput: { backgroundColor: "#1d1d1d", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", borderRadius: 12, color: "#ffffff", paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 12 },
  categoryRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  categoryChip: { borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", paddingHorizontal: 12, paddingVertical: 7 },
  categoryChipActive: { backgroundColor: "rgba(255,45,85,0.26)", borderColor: "#ff2d55" },
  categoryChipText: { color: "#ffffff", fontSize: 12, fontWeight: "700" },
  customItemCard: {
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "#1b1b1b",
    padding: 10
  },
  customItemPhoto: { width: "100%", height: 156, borderRadius: 10, marginBottom: 8 },
  customItemPhotoPlaceholder: {
    height: 120,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 6
  },
  customItemPlaceholderText: { color: "#bbbbbb", fontSize: 12 },
  customItemActionsRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  customItemCaptureButton: {
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255,45,85,0.22)",
    borderWidth: 1,
    borderColor: "#ff2d55"
  },
  customItemCaptureText: { color: "#ffffff", fontSize: 12, fontWeight: "800" },
  customItemClearButton: {
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)"
  },
  customItemClearText: { color: "#ffffff", fontSize: 11, fontWeight: "700" },
  customItemDescriptionInput: { minHeight: 74, textAlignVertical: "top" },
  customItemFieldsRow: { flexDirection: "row", gap: 8 },
  customItemField: { flex: 1 },
  customItemAddButton: {
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#ff2d55"
  },
  customItemAddText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  productsGrid: { gap: 8 },
  goLiveProductCard: { backgroundColor: "#1d1d1d", borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", padding: 8 },
  goLiveProductSelected: { borderColor: "#ff2d55", backgroundColor: "rgba(255,45,85,0.14)" },
  goLiveProductMain: { flexDirection: "row", alignItems: "center" },
  goLiveProductImage: { width: 54, height: 54, borderRadius: 8 },
  goLiveProductMeta: { flex: 1, paddingHorizontal: 10 },
  goLiveProductTitle: { color: "#ffffff", fontSize: 13, fontWeight: "700" },
  goLiveProductDescription: { color: "#cfcfcf", fontSize: 11, marginTop: 3 },
  goLiveProductPrice: { color: "#ffd3df", fontSize: 12, marginTop: 4, fontWeight: "700" },
  selectDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: "#999" },
  selectDotActive: { borderColor: "#ff2d55", backgroundColor: "#ff2d55" },
  inventoryRow: { marginTop: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  inventoryLabel: { color: "#bbbbbb", fontSize: 12, fontWeight: "700" },
  qtyInline: { flexDirection: "row", alignItems: "center", gap: 8 },
  switchRow: { marginTop: 12, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", backgroundColor: "#1c1c1c", padding: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  switchTitle: { color: "#ffffff", fontWeight: "700", fontSize: 13 },
  switchText: { color: "#afafaf", fontSize: 11, marginTop: 3, maxWidth: 220 },
  switchPill: { width: 44, height: 24, borderRadius: 999, backgroundColor: "#555", padding: 2 },
  switchPillActive: { backgroundColor: "#ff2d55" },
  switchDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff" },
  switchDotActive: { transform: [{ translateX: 20 }] },
  goLiveButton: { marginTop: 2, backgroundColor: "#ff2d55", borderRadius: 14, paddingVertical: 12, alignItems: "center" },
  goLiveButtonText: { color: "#ffffff", fontSize: 14, fontWeight: "800" },
  cartScreen: { flex: 1, backgroundColor: "#090909" },
  cartContent: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 110 },
  cartHeader: { color: "#ffffff", fontSize: 26, fontWeight: "900" },
  cartSubheader: { marginTop: 6, color: "#c3c3c3", fontSize: 13 },
  cartWalletCard: { marginTop: 12, backgroundColor: "#151515", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", borderRadius: 16, padding: 12, gap: 8 },
  cartWalletRow: { flexDirection: "row", justifyContent: "space-between" },
  cartWalletLabel: { color: "#bbbbbb", fontSize: 13 },
  cartWalletValue: { color: "#ffe08f", fontSize: 13, fontWeight: "800" },
  cartEmptyCard: { marginTop: 12, backgroundColor: "#151515", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", borderRadius: 16, padding: 20, alignItems: "center" },
  cartEmptyTitle: { color: "#ffffff", fontSize: 20, fontWeight: "900" },
  cartEmptyText: { color: "#bbbbbb", fontSize: 13, textAlign: "center", marginTop: 8 },
  cartItemCard: { marginTop: 10, backgroundColor: "#151515", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", borderRadius: 14, padding: 10, flexDirection: "row", alignItems: "center", gap: 10 },
  cartItemImage: { width: 62, height: 62, borderRadius: 10 },
  cartItemMeta: { flex: 1 },
  cartItemTitle: { color: "#ffffff", fontSize: 13, fontWeight: "700" },
  cartItemPrice: { color: "#ffd89c", fontSize: 12, marginTop: 4 },
  cartItemSubtotal: { color: "#ffffff", fontSize: 12, marginTop: 4, fontWeight: "700" },
  cartItemStream: { color: "#b2b2b2", fontSize: 11, marginTop: 3 },
  countdownText: { color: "#ffb6c3", fontSize: 11, marginTop: 3, fontWeight: "700" },
  qtyColumn: { alignItems: "center", gap: 5 },
  qtyButton: { width: 26, height: 26, borderRadius: 8, backgroundColor: "#242424", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  qtyButtonText: { color: "#ffffff", fontSize: 14, fontWeight: "800" },
  qtyValue: { color: "#ffffff", fontSize: 13, fontWeight: "800" },
  releaseButton: { marginTop: 2, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  releaseText: { color: "#ffffff", fontSize: 10, fontWeight: "700" },
  profileTabScreen: { flex: 1, backgroundColor: "#090909" },
  profileTabContent: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 110, gap: 12 },
  profileHero: { alignItems: "center", backgroundColor: "#151515", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", borderRadius: 18, padding: 16 },
  profileHeroAvatar: { width: 78, height: 78, borderRadius: 39, borderWidth: 2, borderColor: "#fff" },
  profileHeroName: { marginTop: 10, color: "#fff", fontSize: 21, fontWeight: "900" },
  profileHeroHandle: { marginTop: 4, color: "#9fcfff", fontSize: 13, fontWeight: "700" },
  profileHeroBio: { marginTop: 8, textAlign: "center", color: "#d4d4d4", fontSize: 13, lineHeight: 19 },
  profileSignOutButton: {
    marginTop: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,150,170,0.5)",
    backgroundColor: "rgba(255,45,85,0.2)",
    paddingHorizontal: 14,
    paddingVertical: 7
  },
  profileSignOutText: { color: "#ffc2d0", fontSize: 11, fontWeight: "800" },
  walletCard: { backgroundColor: "#151515", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", borderRadius: 16, padding: 12 },
  walletHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  walletTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  walletTitle: { color: "#ffffff", fontSize: 16, fontWeight: "800" },
  walletBalance: { color: "#ffe08f", fontSize: 16, fontWeight: "900" },
  walletSubtext: { marginTop: 6, color: "#c0c0c0", fontSize: 12 },
  tokenPackRow: { marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tokenPackButton: {
    width: "48%",
    backgroundColor: "rgba(255,194,82,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,224,143,0.45)",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: "center"
  },
  tokenPackLabel: { color: "#ffe08f", fontSize: 11, fontWeight: "800", textAlign: "center" },
  walletRechargeButton: {
    marginTop: 10,
    borderRadius: 10,
    backgroundColor: "#ff2d55",
    alignItems: "center",
    paddingVertical: 10
  },
  walletRechargeButtonText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  paymentSectionLabel: { marginTop: 10, marginBottom: 7, color: "#ddd", fontSize: 12, fontWeight: "700" },
  paymentPackWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  paymentPackCard: {
    width: "48%",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "#1d1d1d",
    paddingVertical: 10,
    paddingHorizontal: 10
  },
  paymentPackCardActive: { borderColor: "#ff2d55", backgroundColor: "rgba(255,45,85,0.16)" },
  paymentPackBadge: { color: "#ffd8a6", fontSize: 10, fontWeight: "800", marginBottom: 4 },
  paymentPackTokens: { color: "#fff", fontSize: 12, fontWeight: "800" },
  paymentPackPrice: { color: "#ffe08f", fontSize: 11, marginTop: 4, fontWeight: "700" },
  paymentBestOfferHint: { marginTop: 8, color: "#b8b8b8", fontSize: 11 },
  customRechargeCard: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 10,
    backgroundColor: "#1a1a1a",
    padding: 10
  },
  customRechargeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 },
  customRechargeTitle: { color: "#fff", fontSize: 12, fontWeight: "800", flex: 1 },
  customRechargeFormula: { marginTop: -4, color: "#bfbfbf", fontSize: 11 },
  customRechargeTotal: { marginTop: 8, color: "#ffe08f", fontSize: 12, fontWeight: "800" },
  paymentMethodRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  paymentMethodChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "#1d1d1d",
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  paymentMethodChipActive: { borderColor: "#ff2d55", backgroundColor: "rgba(255,45,85,0.22)" },
  paymentMethodText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  paymentCardRow: { flexDirection: "row", gap: 8 },
  paymentCardHalf: { flex: 1 },
  paymentWalletHint: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "#1c1c1c",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8
  },
  paymentWalletHintText: { color: "#cecece", fontSize: 12 },
  paymentDisabledBtn: { opacity: 0.6 },
  profileStatsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statTile: { width: "48%", backgroundColor: "#161616", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  statTileValue: { color: "#ffffff", fontSize: 18, fontWeight: "900" },
  statTileLabel: { marginTop: 5, color: "#afafaf", fontSize: 12 },
  statTileLight: { backgroundColor: "#ffffff", borderColor: "rgba(20,20,20,0.12)" },
  statTileValueLight: { color: "#111111" },
  statTileLabelLight: { color: "#5d5d5d" },
  profileCard: { backgroundColor: "#151515", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", borderRadius: 16, padding: 12 },
  profileSectionTitle: { color: "#fff", fontSize: 16, fontWeight: "800", marginBottom: 10 },
  bioInput: { minHeight: 74, textAlignVertical: "top" },
  settingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "#1d1d1d", borderRadius: 12, padding: 10, marginBottom: 8 },
  settingRowLight: { borderColor: "rgba(20,20,20,0.12)", backgroundColor: "#ffffff" },
  settingTextWrap: { flex: 1, paddingRight: 8 },
  settingTitle: { color: "#fff", fontSize: 13, fontWeight: "700" },
  settingTitleLight: { color: "#111111" },
  settingSubtitle: { marginTop: 4, color: "#b2b2b2", fontSize: 11 },
  settingSubtitleLight: { color: "#606060" },
  appearanceRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  appearanceChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "#1d1d1d",
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  appearanceChipActive: { borderColor: "#ff2d55", backgroundColor: "rgba(255,45,85,0.22)" },
  appearanceChipText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  appearanceHint: { marginTop: 8, color: "#b5b5b5", fontSize: 11 },
  emptyRecentText: { color: "#b6b6b6", fontSize: 12 },
  orderRow: { borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "#1d1d1d", borderRadius: 12, padding: 10, marginBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  orderTitle: { color: "#ffffff", fontSize: 12, fontWeight: "700" },
  orderMeta: { marginTop: 4, color: "#aaaaaa", fontSize: 11 },
  orderTokens: { color: "#ffe08f", fontSize: 12, fontWeight: "800" },
  roomOverlay: { flex: 1, backgroundColor: "#000000" },
  roomBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.62)" },
  roomSheet: { flex: 1, backgroundColor: "#050505" },
  roomStreamerImage: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  roomNotchCover: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 44,
    backgroundColor: "rgba(0,0,0,0.78)"
  },
  roomShadeTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 160,
    backgroundColor: "rgba(0,0,0,0.42)"
  },
  roomShadeBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 340,
    backgroundColor: "rgba(0,0,0,0.56)"
  },
  roomTopOverlay: {
    paddingTop: 46,
    paddingHorizontal: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start"
  },
  roomTopLeftBlock: { flex: 1, marginRight: 8 },
  roomStreamerTopRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  roomMiniLiveBadge: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  roomMiniViewerText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  roomTopActions: { flexDirection: "row", gap: 8 },
  roomTopIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.52)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)"
  },
  roomHostRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    flex: 1,
    marginRight: 8
  },
  roomHostAvatar: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: "rgba(255,255,255,0.55)" },
  roomHostMeta: { flex: 1 },
  roomTitle: { color: "#ffffff", fontSize: 13, fontWeight: "900" },
  roomSubTitle: { marginTop: 2, color: "#efefef", fontSize: 10 },
  roomFollowBtn: {
    backgroundColor: "#ff2d55",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  roomFollowText: { color: "#fff", fontSize: 11, fontWeight: "900" },
  roomCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)"
  },
  roomRightRail: {
    position: "absolute",
    right: 10,
    top: 130,
    alignItems: "center",
    gap: 12
  },
  viewerLiveLabelWrap: {
    borderRadius: 999,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)"
  },
  viewerLiveLabel: {
    color: "#fff",
    backgroundColor: "#ff2d55",
    paddingHorizontal: 9,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: "800"
  },
  viewerLikeButton: {
    width: 56,
    minHeight: 70,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    gap: 6,
    paddingVertical: 8
  },
  viewerLikeCount: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800"
  },
  roomRailButton: {
    width: 56,
    minHeight: 60,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    gap: 4
  },
  roomRailText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  roomBottomOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 10,
    paddingBottom: 16
  },
  roomProducts: { gap: 8, paddingRight: 52 },
  roomProductCard: {
    width: 178,
    flexDirection: "row",
    backgroundColor: "rgba(12,12,12,0.82)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 12,
    padding: 8,
    gap: 8
  },
  roomProductImage: { width: 56, height: 56, borderRadius: 9 },
  roomProductMeta: { flex: 1, justifyContent: "center" },
  roomProductTitle: { color: "#ffffff", fontSize: 11, fontWeight: "700" },
  roomProductPrice: { color: "#ffe08f", fontSize: 11, marginTop: 3, fontWeight: "700" },
  viewerCommentsCard: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.36)",
    paddingVertical: 8,
    paddingHorizontal: 10
  },
  viewerCommentsList: {
    maxHeight: 112
  },
  viewerCommentItem: {
    marginBottom: 6
  },
  viewerCommentAuthor: {
    color: "#ffcfda",
    fontSize: 10,
    fontWeight: "700"
  },
  viewerCommentBody: {
    color: "#fff",
    fontSize: 11,
    marginTop: 2
  },
  viewerCommentComposer: {
    marginTop: 8,
    flexDirection: "row",
    gap: 8
  },
  viewerCommentInput: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.48)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: 9,
    color: "#fff",
    fontSize: 11,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  viewerCommentSend: {
    backgroundColor: "#ff2d55",
    borderRadius: 9,
    paddingHorizontal: 12,
    justifyContent: "center"
  },
  viewerCommentSendText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800"
  },
  itemCameraOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.96)",
    justifyContent: "center"
  },
  itemCameraShell: {
    flex: 1
  },
  itemCameraPreview: {
    flex: 1
  },
  itemCameraPreviewImage: {
    flex: 1,
    width: "100%",
    height: "100%"
  },
  itemCameraTopBar: {
    position: "absolute",
    top: 54,
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    flexDirection: "row",
    justifyContent: "space-between"
  },
  itemCameraTopBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    backgroundColor: "rgba(0,0,0,0.42)"
  },
  itemCameraTopBtnPlaceholder: { width: 38, height: 38 },
  itemCameraBottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 36,
    alignItems: "center"
  },
  itemCameraCaptureBtn: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.8)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.15)"
  },
  itemCameraCaptureInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: "#ffffff"
  },
  itemCameraReviewActions: {
    width: "100%",
    paddingHorizontal: 18,
    flexDirection: "row",
    gap: 10
  },
  itemCameraActionBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center"
  },
  itemCameraRetakeBtn: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    backgroundColor: "rgba(0,0,0,0.45)"
  },
  itemCameraUseBtn: {
    backgroundColor: "#ff2d55"
  },
  itemCameraActionText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800"
  },
  searchOverlay: { flex: 1, justifyContent: "flex-end" },
  searchBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.65)" },
  searchSheet: {
    backgroundColor: "#121212",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)"
  },
  searchSheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  searchSheetTitle: { color: "#fff", fontSize: 18, fontWeight: "900" },
  searchInput: {
    marginTop: 10,
    backgroundColor: "#1c1c1c",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 10,
    color: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13
  },
  searchHint: { color: "#bcbcbc", fontSize: 12, marginTop: 10, marginBottom: 8 },
  searchCategoryWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  searchCategoryChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "#1f1f1f",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  searchCategoryChipActive: { borderColor: "#ff2d55", backgroundColor: "rgba(255,45,85,0.28)" },
  searchCategoryChipText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  searchActions: { flexDirection: "row", justifyContent: "space-between", marginTop: 14 },
  searchClearBtn: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  searchClearText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  searchApplyBtn: { backgroundColor: "#ff2d55", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 },
  searchApplyText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  tabBar: { position: "absolute", bottom: 10, left: 14, right: 14, borderRadius: 16, backgroundColor: "rgba(10,10,10,0.92)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", flexDirection: "row", justifyContent: "space-around", paddingVertical: 10 },
  tabButton: { minWidth: 70, alignItems: "center", gap: 4 },
  tabButtonPressed: { transform: [{ scale: 0.96 }], opacity: 0.9 },
  tabLabel: { color: "rgba(255,255,255,0.65)", fontSize: 11, fontWeight: "700" }
});






