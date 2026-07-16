// apps/miniapp/src/pages/index/index.tsx

import { View, Text, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { observer } from 'mobx-react-lite';

const Index = observer(() => {
  const handlePublishReward = () => {
    Taro.showToast({
      title: '发布悬赏功能开发中',
      icon: 'none',
    });
  };

  const handleBookService = () => {
    Taro.showToast({
      title: '预约服务功能开发中',
      icon: 'none',
    });
  };

  return (
    <View className="container">
      <View className="header">
        <Text className="title">PetCare宠伴</Text>
        <Text className="subtitle">让宠物得到更好的照顾</Text>
      </View>

      <View className="mode-selector">
        <View className="mode-card" onClick={handlePublishReward}>
          <Text className="mode-title">发布悬赏</Text>
          <Text className="mode-desc">自定义价格，快速找到宠托师</Text>
        </View>

        <View className="mode-card" onClick={handleBookService}>
          <Text className="mode-title">预约服务</Text>
          <Text className="mode-desc">平台定价，标准化服务</Text>
        </View>
      </View>

      <View className="section">
        <Text className="section-title">热门悬赏订单</Text>
        <View className="order-list">
          <View className="order-item">
            <Text className="order-text">暂无订单</Text>
          </View>
        </View>
      </View>
    </View>
  );
});

export default Index;
