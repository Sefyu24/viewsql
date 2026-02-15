"use client";

import * as React from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import * as CoreIcons from "@hugeicons/core-free-icons";

type IconProps = Omit<React.ComponentProps<typeof HugeiconsIcon>, "icon">;

type IconName = {
  [K in keyof typeof CoreIcons]: (typeof CoreIcons)[K] extends IconSvgElement
    ? K
    : never;
}[keyof typeof CoreIcons];

type IconMap = {
  [K in IconName]: React.FC<IconProps>;
};

export const Icon = new Proxy({} as IconMap, {
  get(_, iconName: string) {
    const iconDef = (CoreIcons as Record<string, IconSvgElement>)[iconName];
    if (!iconDef) return undefined;
    const IconComponent = (props: IconProps) => (
      <HugeiconsIcon {...props} icon={iconDef} />
    );
    IconComponent.displayName = iconName;
    return IconComponent;
  },
});
