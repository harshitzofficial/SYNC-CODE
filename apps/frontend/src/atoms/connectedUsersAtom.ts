import { atom } from "recoil";

export const connectedUsersAtom = atom<any>({
    key:"connectedUserAtom",
    default: [],
})