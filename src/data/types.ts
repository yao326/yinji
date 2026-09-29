export type Photo = {
  id: string;
  title: string;
  image: string;
  thumb: string;
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

export type StoredPhoto = {
  id: string;
  title: string;
  date: string;
  blob: Blob;
  thumbBlob?: Blob;
};

export type StoredLocation = {
  id: string;
  name: string;
  country: string;
  coordinates: [number, number];
  coverPhotoId: string;
  photos: StoredPhoto[];
  renamed?: boolean;
};