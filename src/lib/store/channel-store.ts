import { create } from "zustand";
import type { Channel } from "@/types";

type PickChannel = Pick<Channel, "id" | "name">;

// Simplified store - only responsible for channel selection
interface ChannelState {
  selectedChannel: PickChannel | null;
  setSelectedChannel: (channel: PickChannel | null) => void;
}

export const useChannelStore = create<ChannelState>()((set) => ({
  selectedChannel: null,
  setSelectedChannel: (channel) => set({ selectedChannel: channel }),
}));
