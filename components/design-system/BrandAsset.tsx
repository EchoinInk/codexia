import Image from "next/image";
import { codexiaAssets, codierPoses, type CodexiaLogoVariant, type CodexiaSymbolVariant, type CodierPose } from "@/lib/design-system/assets";

type SharedProps = { className?: string; priority?: boolean };

export function CodexiaLogo({ variant = "light", className, priority }: SharedProps & { variant?: CodexiaLogoVariant }) {
  return <Image src={codexiaAssets.logo[variant]} alt="Codexia" width={240} height={80} className={className} priority={priority} />;
}

export function CodexiaSymbol({ variant = "primary", className, priority }: SharedProps & { variant?: CodexiaSymbolVariant }) {
  return <Image src={codexiaAssets.symbol[variant]} alt="" aria-hidden="true" width={48} height={48} className={className} priority={priority} />;
}

export function CodierAsset({ pose, alt, className, priority }: SharedProps & { pose: CodierPose; alt: string }) {
  return <Image src={codierPoses[pose]} alt={alt} width={768} height={512} className={className} priority={priority} />;
}
