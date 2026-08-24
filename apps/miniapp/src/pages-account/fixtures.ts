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
