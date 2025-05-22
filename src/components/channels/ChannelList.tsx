import { useCallback, memo, useEffect } from "react";
import type { Channel } from "@/types";
import { useChannelStore } from "@/lib/store/channel-store";
import { cn } from "@/lib/utils";

type ChannelListProps = {
  channels: Channel[];
};

// Using memo to prevent unnecessary re-renders
export const ChannelList = memo(({ channels }: ChannelListProps) => {
  const { selectedChannel, setSelectedChannel } = useChannelStore();

  useEffect(() => {
    // Reset selected channel when channels change
    if (channels.length > 0 && !selectedChannel) {
      setSelectedChannel({ id: channels[0].id, name: channels[0].name });
    }
  }, [channels]);

  // Optimized memoized click handler with inline function
  const handleChannelClick = useCallback(
    (channelId: string, channelName: string) => {
      setSelectedChannel(
        channelId === selectedChannel?.id
          ? null
          : { id: channelId, name: channelName }
      );
    },
    [selectedChannel?.id, setSelectedChannel] // Only depend on the ID, not the entire object
  );

  return (
    <div className="flex flex-col gap-4 w-full max-w-xs">
      {channels.length === 0 ? (
        <div className="flex items-center justify-center rounded-md border p-4 shadow-sm">
          <span className="text-lg font-semibold">No channels found</span>
        </div>
      ) : (
        channels.map((channel) => (
          <div
            key={channel.id}
            className={cn(
              "p-2 bg-card flex items-center justify-between rounded-md border hover:border-blue-500 cursor-pointer transition-all duration-200 ease-in-out",
              selectedChannel?.id === channel.id &&
                "border-blue-500 bg-blue-50/10"
            )}
            onClick={() => handleChannelClick(channel.id, channel.name)}
          >
            <div className="flex items-center w-full">
              <span className="text-lg font-semibold truncate">
                #{channel.name}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );
});
