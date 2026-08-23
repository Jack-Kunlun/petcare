export const profileFixture = {
  id: "owner-1",
  name: "郑先生",
  city: "上海市 · 静安区",
  phone: "138****8621",
  bio: "认真记录每一次托付，也愿意分享真实养宠经验。",
  credit: 720,
} as const;

export const petFixtures = [
  {
    id: "mimi",
    name: "咪咪",
    breed: "英国短毛猫",
    species: "猫",
    age: "3岁",
    image: "/static/main/profile-cat.png",
  },
  {
    id: "wangcai",
    name: "旺财",
    breed: "金毛寻回犬",
    species: "狗",
    age: "4岁",
    image: "/static/main/profile-dog.png",
  },
] as const;

export function getPetById(id?: string) {
  return petFixtures.find((pet) => pet.id === id) ?? petFixtures[0];
}
