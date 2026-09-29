export type City = { name: string; coordinates: [number, number] };

// 中国主要城市（省会、直辖市及常见旅游城市），用于离线反查地名兜底
export const CHINA_CITIES: City[] = [
  { name: "北京", coordinates: [116.4074, 39.9042] },
  { name: "上海", coordinates: [121.4737, 31.2304] },
  { name: "天津", coordinates: [117.2009, 39.0842] },
  { name: "重庆", coordinates: [106.5516, 29.5630] },
  { name: "广州", coordinates: [113.2644, 23.1291] },
  { name: "深圳", coordinates: [114.0579, 22.5431] },
  { name: "杭州", coordinates: [120.1551, 30.2741] },
  { name: "南京", coordinates: [118.7969, 32.0603] },
  { name: "苏州", coordinates: [120.5853, 31.2989] },
  { name: "武汉", coordinates: [114.3054, 30.5931] },
  { name: "成都", coordinates: [104.0665, 30.5723] },
  { name: "西安", coordinates: [108.9398, 34.3416] },
  { name: "长沙", coordinates: [112.9388, 28.2282] },
  { name: "郑州", coordinates: [113.6254, 34.7466] },
  { name: "沈阳", coordinates: [123.4315, 41.8057] },
  { name: "大连", coordinates: [121.6147, 38.9140] },
  { name: "青岛", coordinates: [120.3826, 36.0671] },
  { name: "济南", coordinates: [117.1205, 36.6512] },
  { name: "合肥", coordinates: [117.2272, 31.8206] },
  { name: "南昌", coordinates: [115.8582, 28.6829] },
  { name: "福州", coordinates: [119.2965, 26.0745] },
  { name: "厦门", coordinates: [118.0894, 24.4798] },
  { name: "泉州", coordinates: [118.6759, 24.8741] },
  { name: "昆明", coordinates: [102.8329, 24.8801] },
  { name: "贵阳", coordinates: [106.6302, 26.6470] },
  { name: "南宁", coordinates: [108.3669, 22.8170] },
  { name: "桂林", coordinates: [110.2900, 25.2736] },
  { name: "海口", coordinates: [110.1999, 20.0444] },
  { name: "三亚", coordinates: [109.5119, 18.2528] },
  { name: "哈尔滨", coordinates: [126.5349, 45.8038] },
  { name: "长春", coordinates: [125.3235, 43.8171] },
  { name: "石家庄", coordinates: [114.5149, 38.0428] },
  { name: "太原", coordinates: [112.5489, 37.8706] },
  { name: "兰州", coordinates: [103.8343, 36.0611] },
  { name: "西宁", coordinates: [101.7782, 36.6171] },
  { name: "银川", coordinates: [106.2309, 38.4872] },
  { name: "乌鲁木齐", coordinates: [87.6168, 43.8256] },
  { name: "拉萨", coordinates: [91.1409, 29.6456] },
  { name: "呼和浩特", coordinates: [111.7492, 40.8426] },
  { name: "香港", coordinates: [114.1694, 22.3193] },
  { name: "澳门", coordinates: [113.5439, 22.1987] },
  { name: "无锡", coordinates: [120.3119, 31.4912] },
  { name: "宁波", coordinates: [121.5503, 29.8746] },
  { name: "温州", coordinates: [120.6994, 27.9949] },
  { name: "佛山", coordinates: [113.1214, 23.0218] },
  { name: "东莞", coordinates: [113.7518, 23.0207] },
  { name: "珠海", coordinates: [113.5767, 22.2707] },
  { name: "烟台", coordinates: [121.4479, 37.4638] },
  { name: "潍坊", coordinates: [119.1618, 36.7069] },
  { name: "洛阳", coordinates: [112.4540, 34.6197] },
  { name: "徐州", coordinates: [117.2841, 34.2058] },
  { name: "常州", coordinates: [119.9741, 31.8107] },
  { name: "南通", coordinates: [120.8943, 31.9802] },
  { name: "嘉兴", coordinates: [120.7555, 30.7461] },
  { name: "绍兴", coordinates: [120.5802, 30.0303] },
  { name: "台州", coordinates: [121.4206, 28.6564] },
  { name: "汕头", coordinates: [116.6820, 23.3535] },
  { name: "保定", coordinates: [115.4646, 38.8740] },
  { name: "唐山", coordinates: [118.1802, 39.6305] },
  { name: "秦皇岛", coordinates: [119.6005, 39.9354] },
  { name: "张家界", coordinates: [110.4792, 29.1170] },
  { name: "丽江", coordinates: [100.2277, 26.8550] },
  { name: "大理", coordinates: [100.2676, 25.6065] },
  { name: "香格里拉", coordinates: [99.7008, 27.8233] },
  { name: "景洪", coordinates: [100.7999, 22.0108] },
  { name: "遵义", coordinates: [106.9274, 27.7257] },
  { name: "敦煌", coordinates: [94.6616, 40.1421] },
  { name: "嘉峪关", coordinates: [98.2892, 39.7719] },
  { name: "张掖", coordinates: [100.4498, 38.9259] },
  { name: "吐鲁番", coordinates: [89.1895, 42.9513] },
  { name: "喀什", coordinates: [75.9898, 39.4704] },
  { name: "伊宁", coordinates: [81.3241, 43.9169] },
  { name: "九江", coordinates: [115.9910, 29.7055] },
  { name: "景德镇", coordinates: [117.1784, 29.2688] },
  { name: "上饶", coordinates: [117.9434, 28.4549] },
  { name: "鹰潭", coordinates: [117.0692, 28.2602] },
  { name: "抚州", coordinates: [116.3581, 27.9490] },
  { name: "宜春", coordinates: [114.4168, 27.8156] },
  { name: "萍乡", coordinates: [113.8546, 27.6227] },
  { name: "新余", coordinates: [114.9174, 27.8178] },
  { name: "吉安", coordinates: [114.9929, 27.1132] },
  { name: "赣州", coordinates: [114.9350, 25.8311] },
  { name: "井冈山", coordinates: [114.2849, 26.6336] },
  { name: "株洲", coordinates: [113.1338, 27.8274] },
  { name: "湘潭", coordinates: [112.9441, 27.8297] },
  { name: "衡阳", coordinates: [112.5719, 26.8932] },
  { name: "邵阳", coordinates: [111.4678, 27.2386] },
  { name: "岳阳", coordinates: [113.1290, 29.3571] },
  { name: "常德", coordinates: [111.6985, 29.0317] },
  { name: "益阳", coordinates: [112.3552, 28.5539] },
  { name: "郴州", coordinates: [113.0148, 25.7706] },
  { name: "永州", coordinates: [111.6134, 26.4203] },
  { name: "怀化", coordinates: [110.0016, 27.5698] },
  { name: "娄底", coordinates: [111.9935, 27.7002] },
  { name: "吉首", coordinates: [109.7386, 28.3115] }
];

function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// 返回最近的中国城市名；距离超过 250 公里则认为不在已知城市范围内，返回 null
export function matchCity(lng: number, lat: number): string | null {
  let best: City | null = null;
  let bestDist = Infinity;
  for (const city of CHINA_CITIES) {
    const d = haversineKm([lng, lat], city.coordinates);
    if (d < bestDist) {
      bestDist = d;
      best = city;
    }
  }
  if (!best || bestDist > 250) return null;
  return best.name;
}