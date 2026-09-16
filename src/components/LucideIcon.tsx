import React from "react";
import * as Icons from "lucide-react";

interface LucideIconProps {
  name: string;
  className?: string;
  size?: number;
}

export default function LucideIcon({ name, className = "", size = 24 }: LucideIconProps) {
  const IconComponent = (Icons as any)[name];
  
  if (!IconComponent) {
    return <Icons.BookOpen className={className} size={size} />;
  }
  
  return <IconComponent className={className} size={size} />;
}
