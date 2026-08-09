export interface TabbarItem {
  name: string;
  value?: number;
  active: boolean;
  title: string;
  icon: string;
}

const tabbarItems = ref<TabbarItem[]>([
  { name: "home", active: true, title: "首页", icon: "home" },
  { name: "about", active: false, title: "关于", icon: "user" },
]);

function getTabbarItemValue(name: string) {
  const item = tabbarItems.value.find((item) => item.name === name);

  return item?.value;
}

function setTabbarItem(name: string, value: number) {
  const tabbarItem = tabbarItems.value.find((item) => item.name === name);

  if (tabbarItem) {
    tabbarItem.value = value;
  }
}

function setTabbarItemActive(name: string) {
  tabbarItems.value.forEach((item) => {
    item.active = item.name === name;
  });
}

export function useTabbar() {
  const tabbarList = computed(() => tabbarItems.value);

  const activeTabbar = computed(() => {
    const item = tabbarItems.value.find((item) => item.active);

    return item || tabbarItems.value[0];
  });

  return {
    tabbarList,
    activeTabbar,
    getTabbarItemValue,
    setTabbarItem,
    setTabbarItemActive,
  };
}
