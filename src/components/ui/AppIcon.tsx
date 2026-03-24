'use client';

import React from 'react';
import * as HeroOutline from '@heroicons/react/24/outline';
import * as HeroSolid from '@heroicons/react/24/solid';

interface AppIconProps {
  name: string;
  size?: number;
  className?: string;
  variant?: 'outline' | 'solid';
  [key: string]: any;
}

export default function AppIcon({
  name,
  size = 24,
  className = '',
  variant = 'outline',
  ...props
}: AppIconProps) {
  const icons = variant === 'solid' ? HeroSolid : HeroOutline;
  const Icon = (icons as Record<string, any>)[name];

  if (!Icon) {
    return (
      <span
        className={`inline-block bg-gray-200 rounded ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return <Icon width={size} height={size} className={className} {...props} />;
}
