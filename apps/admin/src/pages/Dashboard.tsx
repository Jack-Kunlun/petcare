export default function Dashboard() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">仪表盘</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm">总用户数</h3>
          <p className="text-3xl font-bold mt-2">1,234</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm">今日订单</h3>
          <p className="text-3xl font-bold mt-2">56</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm">本月收入</h3>
          <p className="text-3xl font-bold mt-2">¥12,345</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm">待处理纠纷</h3>
          <p className="text-3xl font-bold mt-2 text-red-600">3</p>
        </div>
      </div>
    </div>
  );
}
