export type Photo = {
  id: string;
  title: string;
  image: string;
  date: string;
};

export type PhotoLocation = {
  id: string;
  name: string;
  country: string;
  coordinates: [number, number];
  coverPhotoId: string;
  photos: Photo[];
};

export const demoLocations: PhotoLocation[] = [
  {
    id: "nanchang",
    name: "南昌",
    country: "中国 · 江西",
    coordinates: [115.8582, 28.6829],
    coverPhotoId: "nc-1",
    photos: [
      { id: "nc-1", title: "傍晚的云", image: "/samples/nanchang-1.svg", date: "2026-09-29" },
      { id: "nc-2", title: "赣江边", image: "/samples/nanchang-2.svg", date: "2026-08-17" },
      { id: "nc-3", title: "夏天的街", image: "/samples/nanchang-3.svg", date: "2026-07-03" }
    ]
  },
  {
    id: "beijing",
    name: "北京",
    country: "中国 · 北京",
    coordinates: [116.4074, 39.9042],
    coverPhotoId: "bj-1",
    photos: [
      { id: "bj-1", title: "清晨的城市", image: "/samples/beijing-1.svg", date: "2025-11-08" },
      { id: "bj-2", title: "胡同散步", image: "/samples/beijing-2.svg", date: "2025-10-21" },
      { id: "bj-3", title: "冬天第一场雪", image: "/samples/beijing-3.svg", date: "2025-12-14" }
    ]
  },
  {
    id: "shanghai",
    name: "上海",
    country: "中国 · 上海",
    coordinates: [121.4737, 31.2304],
    coverPhotoId: "sh-1",
    photos: [
      { id: "sh-1", title: "夜色与灯光", image: "/samples/shanghai-1.svg", date: "2026-04-06" },
      { id: "sh-2", title: "外滩的风", image: "/samples/shanghai-2.svg", date: "2026-04-05" },
      { id: "sh-3", title: "街角咖啡店", image: "/samples/shanghai-3.svg", date: "2026-04-07" }
    ]
  },
  {
    id: "chengdu",
    name: "成都",
    country: "中国 · 四川",
    coordinates: [104.0668, 30.5728],
    coverPhotoId: "cd-1",
    photos: [
      { id: "cd-1", title: "雨后的山", image: "/samples/chengdu-1.svg", date: "2025-06-12" },
      { id: "cd-2", title: "路边的小店", image: "/samples/chengdu-2.svg", date: "2025-06-13" },
      { id: "cd-3", title: "慢下来的下午", image: "/samples/chengdu-3.svg", date: "2025-06-14" }
    ]
  }
];