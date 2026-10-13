import { BottomNavigation, Icon } from "zmp-ui";
import { useNavigate, useLocation } from "react-router-dom";

const TABS = [
  {
    key: "home",
    label: "Trang chủ",
    icon: "zi-home",
    path: "/",
  },
  {
    key: "procedures",
    label: "Thủ tục",
    icon: "zi-list-1",
    path: "/procedures",
  },
  {
    key: "posts",
    label: "Tin tức",
    icon: "zi-star",
    path: "/posts",
  },
  {
    key: "account",
    label: "Của tôi",
    icon: "zi-user",
    path: "/account",
  },
];

// Ẩn thanh điều hướng ở các trang chi tiết.
const DETAIL_PATTERNS = [
  /^\/procedures\/.+/,
  /^\/posts\/.+/,
  /^\/notices\/.+/,
];

function AppBottomNavigation() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isDetail = DETAIL_PATTERNS.some((pattern) =>
    pattern.test(pathname)
  );

  if (isDetail) {
    return null;
  }

  const activeTab = TABS.find((tab) => {
    if (tab.path === "/") {
      return pathname === "/";
    }

    return (
      pathname === tab.path ||
      pathname.startsWith(`${tab.path}/`)
    );
  });

  const activeKey = activeTab?.key ?? "home";

  const handleChange = (key) => {
    const tab = TABS.find((item) => item.key === key);

    if (tab && pathname !== tab.path) {
      navigate(tab.path);
    }
  };

  return (
    <BottomNavigation
      fixed
      activeKey={activeKey}
      onChange={handleChange}
    >
      {TABS.map((tab) => (
        <BottomNavigation.Item
          key={tab.key}
          label={tab.label}
          icon={<Icon icon={tab.icon} />}
        />
      ))}
    </BottomNavigation>
  );
}

export default AppBottomNavigation;