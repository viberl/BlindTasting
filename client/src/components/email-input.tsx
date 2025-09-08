import React from 'react';
import { Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface EmailInputProps {
  control: any;
  name: string;
}

export function EmailInput({ control, name }: EmailInputProps) {
  return (
    <div>
      <Label htmlFor={name}>Email</Label>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <Input {...field} type="email" />
        )}
      />
    </div>
  );
}
