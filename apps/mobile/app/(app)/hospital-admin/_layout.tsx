import { Tabs } from "expo-router";
import { useRef, useEffect, type ReactElement } from "react";
import { Animated, Pressable, View, Text, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Calendar, Bell, Shield, User } from "lucide-react-native";

const NAVY = "#162B4A";
const TEAL = "#2ABFBF";

const TABS = [
  { name: "shifts", label: "Operação", Icon: Calendar },
  { name: "coverage", label: "Cobertura", Icon: Shield },
  { name: "notifications", label: "Alertas", Icon: Bell },
  { name: "profile", label: "Perfil", Icon: User },
];

function TabButton({
  isFocused,
  label,
  Icon,
  onPress,
}: {
  isFocused: boolean;
  label: string;
  Icon: any;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const dotScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: isFocused ? 1.1 : 1,
        useNativeDriver: true,
        tension: 280,
        friction: 16,
      }),
      Animated.spring(dotScale, {
        toValue: isFocused ? 1 : 0,
        useNativeDriver: true,
        tension: 280,
        friction: 16,
      }),
    ]).start();
  }, [isFocused, dotScale, scale]);

  return (
    <Pressable
      onPress={onPress}
      style={{ flex: 1, alignItems: "center", paddingVertical: 10 }}
      android_ripple={{ color: "transparent" }}
    >
      <Animated.View
        style={{ transform: [{ scale }], alignItems: "center", gap: 4 }}
      >
        <Icon
          size={22}
          color={isFocused ? TEAL : "#94A3B8"}
          strokeWidth={isFocused ? 2.5 : 1.7}
        />
        <Text
          style={{
            fontSize: 10,
            fontWeight: isFocused ? "700" : "500",
            color: isFocused ? TEAL : "#94A3B8",
            letterSpacing: 0.3,
          }}
        >
          {label}
        </Text>
        <Animated.View
          style={{
            width: 4,
            height: 4,
            borderRadius: 2,
            backgroundColor: TEAL,
            transform: [{ scale: dotScale }],
          }}
        />
      </Animated.View>
    </Pressable>
  );
}

function HospitalAdminTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: "#fff",
        borderTopWidth: 1,
        borderTopColor: "#EEF2F7",
        paddingBottom: Math.max(insets.bottom, 6),
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.07,
        shadowRadius: 12,
        elevation: 14,
      }}
    >
      {state.routes.map((route: any, i: number) => {
        const tab = TABS.find((t) => t.name === route.name);
        if (!tab) return null;
        const isFocused = state.index === i;
        return (
          <TabButton
            key={route.key}
            isFocused={isFocused}
            label={tab.label}
            Icon={tab.Icon}
            onPress={() => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            }}
          />
        );
      })}
    </View>
  );
}

function HeaderLogo() {
  return (
    <Image
      source={require("../../../assets/dark_logo_v.png")}
      style={{ width: 112, height: 28, marginLeft: 4 }}
      resizeMode="contain"
    />
  );
}

export default function HospitalAdminLayout(): ReactElement {
  return (
    <Tabs
      tabBar={(props) => <HospitalAdminTabBar {...props} />}
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: NAVY },
        headerTitleStyle: {
          color: "#fff",
          fontWeight: "700",
          fontSize: 16,
          letterSpacing: 0.2,
        },
        headerTintColor: "#fff",
        headerLeft: () => <HeaderLogo />,
        headerLeftContainerStyle: { paddingLeft: 8 },
        headerTitleContainerStyle: { paddingLeft: 8 },
      }}
    >
      <Tabs.Screen name="shifts" options={{ title: "Operação e escala" }} />
      <Tabs.Screen name="coverage" options={{ title: "Cobertura" }} />
      <Tabs.Screen name="notifications" options={{ title: "Notificações" }} />
      <Tabs.Screen name="profile" options={{ title: "Perfil" }} />
      <Tabs.Screen name="edit-profile" options={{ href: null, headerShown: false }} />
    </Tabs>
  );
}
