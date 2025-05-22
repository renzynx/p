import type { Guild } from "@/types";
import { Card } from "../ui/card";
import { navigate } from "astro:transitions/client";

type GuildListProps = {
  guilds: Guild[];
};
export const GuildList = ({ guilds }: GuildListProps) => {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {guilds.length === 0 ? (
        <div className="col-span-1 flex items-center justify-center rounded-md border p-4 shadow-sm">
          <span className="text-lg font-semibold">No guilds found</span>
        </div>
      ) : (
        guilds.map((guild) => (
          <Card
            key={guild.id}
            className="col-span-1 flex items-center justify-between rounded-md border hover:border-b-blue-500 cursor-pointer transition-all duration-200 ease-in-out"
            onClick={() => navigate(`/guild/${guild.id}`)}
          >
            <div className="flex items-center">
              <img
                src={
                  guild.icon
                    ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`
                    : "https://cdn.discordapp.com/embed/avatars/0.png"
                }
                alt={guild.name}
                className="h-10 w-10 rounded-full"
              />
              <span className="ml-4 text-lg font-semibold">{guild.name}</span>
            </div>
          </Card>
        ))
      )}
    </div>
  );
};
