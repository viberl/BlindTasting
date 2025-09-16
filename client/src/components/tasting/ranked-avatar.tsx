import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const medalClasses: Record<number, string> = {
  1: "bg-[#FFD700] text-white", // gold
  2: "bg-[#C0C0C0] text-white", // silver
  3: "bg-[#CD7F32] text-white", // bronze
};

interface RankedAvatarProps {
  imageUrl?: string | null;
  name?: string | null;
  rank: number;
  sizeClass?: string;
}

export default function RankedAvatar({ imageUrl, name, rank, sizeClass = "h-12 w-12" }: RankedAvatarProps) {
  const fallback = name?.charAt(0)?.toUpperCase() ?? "?";
  const medalClass = medalClasses[rank] ?? "bg-[#274E37] text-white";

  return (
    <div className="relative inline-block">
      <Avatar className={`${sizeClass} border border-gray-200`}>
        <AvatarImage src={imageUrl ?? undefined} alt={name ?? 'Avatar'} />
        <AvatarFallback>{fallback}</AvatarFallback>
      </Avatar>
      <div
        className={`absolute -bottom-1 -right-1 h-6 w-6 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold ${medalClass}`}
      >
        {rank}
      </div>
    </div>
  );
}
