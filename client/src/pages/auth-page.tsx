import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocation } from 'wouter';
import { Wine } from 'lucide-react';

// Validation schemas
const loginSchema = z.object({
  email: z.string().email('Gültige E-Mail-Adresse erforderlich'),
  password: z.string().min(6, 'Passwort muss mindestens 6 Zeichen lang sein'),
});

const registerSchema = z.object({
  name: z.string().min(2, 'Name muss mindestens 2 Zeichen lang sein'),
  email: z.string().email('Gültige E-Mail-Adresse erforderlich'),
  password: z.string().min(6, 'Passwort muss mindestens 6 Zeichen lang sein'),
  company: z.string().min(2, 'Firmenname muss angegeben werden'),
  profileImage: z.string().min(1, 'Profilbild ist erforderlich'),
});

type LoginFormData = z.infer<typeof loginSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const { user, isLoading, loginMutation, registerMutation } = useAuth();
  const [_, navigate] = useLocation();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      company: '',
      profileImage: '',
    },
  });

  const onLoginSubmit = (data: LoginFormData) => {
    loginMutation.mutate(data);
  };

  const onRegisterSubmit = (data: RegisterFormData) => {
    registerMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-10 h-10 border-4 border-[#4C0519] border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 flex flex-col md:flex-row gap-8 min-h-screen items-center">
      {/* Form Section */}
      <div className="md:w-1/2 w-full max-w-md mx-auto">
        <Card className="border-0 shadow-lg">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <Wine className="h-6 w-6 text-[#4C0519]" />
              <CardTitle className="text-2xl font-bold text-[#4C0519]">BlindSip</CardTitle>
            </div>
            <CardDescription>
              Melden Sie sich an, um an Weintastings teilzunehmen oder Ihre eigenen zu erstellen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" value={activeTab} onValueChange={(value) => setActiveTab(value as 'login' | 'register')}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Anmelden</TabsTrigger>
                <TabsTrigger value="register">Registrieren</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login">
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                    <FormField
                      control={loginForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>E-Mail</FormLabel>
                          <FormControl>
                            <Input placeholder="ihre.email@beispiel.de" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={loginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Passwort</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button 
                      type="submit" 
                      className="w-full bg-[#4C0519] hover:bg-[#3A0413]"
                      disabled={loginMutation.isPending}
                    >
                      {loginMutation.isPending ? 'Anmeldung...' : 'Anmelden'}
                    </Button>
                  </form>
                </Form>
              </TabsContent>
              
              <TabsContent value="register">
                <Form {...registerForm}>
                  <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                    <FormField
                      control={registerForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Max Mustermann" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>E-Mail</FormLabel>
                          <FormControl>
                            <Input placeholder="ihre.email@beispiel.de" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="company"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Unternehmen</FormLabel>
                          <FormControl>
                            <Input placeholder="Ihre Firma GmbH" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="profileImage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Profilbild</FormLabel>
                          <FormControl>
                            <div className="flex flex-col gap-2">
                              <Input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    // Bildoptimierung
                                    const compressImage = (file: File): Promise<string> => {
                                      return new Promise((resolve) => {
                                        const reader = new FileReader();
                                        reader.onload = (event) => {
                                          const img = new Image();
                                          img.onload = () => {
                                            // Bild auf maximal 300x300 Pixel reduzieren
                                            const maxSize = 300;
                                            let width = img.width;
                                            let height = img.height;
                                            
                                            if (width > height) {
                                              if (width > maxSize) {
                                                height = Math.round((height * maxSize) / width);
                                                width = maxSize;
                                              }
                                            } else {
                                              if (height > maxSize) {
                                                width = Math.round((width * maxSize) / height);
                                                height = maxSize;
                                              }
                                            }
                                            
                                            const canvas = document.createElement('canvas');
                                            canvas.width = width;
                                            canvas.height = height;
                                            
                                            const ctx = canvas.getContext('2d');
                                            ctx?.drawImage(img, 0, 0, width, height);
                                            
                                            // Als JPEG mit reduzierter Qualität speichern
                                            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                                            resolve(dataUrl);
                                          };
                                          img.src = event.target?.result as string;
                                        };
                                        reader.readAsDataURL(file);
                                      });
                                    };
                                    
                                    // Bild komprimieren und dann speichern
                                    compressImage(file).then(optimizedDataUrl => {
                                      field.onChange(optimizedDataUrl);
                                    });
                                  }
                                }}
                              />
                              {field.value && (
                                <div className="relative w-20 h-20 mt-2 rounded-full overflow-hidden">
                                  <img 
                                    src={field.value} 
                                    alt="Profil Vorschau" 
                                    className="w-full h-full object-cover" 
                                  />
                                </div>
                              )}
                            </div>
                          </FormControl>
                          <FormDescription>
                            Laden Sie ein Profilbild hoch (PNG, JPG)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Passwort</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button 
                      type="submit" 
                      className="w-full bg-[#4C0519] hover:bg-[#3A0413]"
                      disabled={registerMutation.isPending}
                    >
                      {registerMutation.isPending ? 'Registrierung...' : 'Registrieren'}
                    </Button>
                  </form>
                </Form>
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <div className="text-center text-sm text-muted-foreground mt-2">
              <span onClick={() => setActiveTab(activeTab === 'login' ? 'register' : 'login')} className="cursor-pointer text-[#4C0519] hover:underline">
                {activeTab === 'login' ? 'Noch kein Konto? Jetzt registrieren' : 'Bereits registriert? Anmelden'}
              </span>
            </div>
          </CardFooter>
        </Card>
      </div>

      {/* Hero Section */}
      <div className="md:w-1/2 flex flex-col items-center md:items-start gap-6 text-center md:text-left">
        <h1 className="text-4xl font-bold !leading-tight">
          <span className="bg-gradient-to-r from-[#4C0519] to-[#8C1F41] bg-clip-text text-transparent">
            Erleben Sie Blindverkostungen wie nie zuvor
          </span>
        </h1>
        <p className="text-lg text-gray-600 max-w-md">
          BlindSip macht es einfach, spannende Weintastings zu organisieren und daran teilzunehmen. Testen Sie Ihr Weinwissen in einer interaktiven Umgebung.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 w-full max-w-md">
          <div className="bg-[#4C0519]/5 p-4 rounded-lg">
            <h3 className="font-semibold text-[#4C0519]">Gastgeber</h3>
            <p className="text-sm text-gray-600">Erstellen und organisieren Sie Tastings mit Freunden oder öffentlich</p>
          </div>
          <div className="bg-[#4C0519]/5 p-4 rounded-lg">
            <h3 className="font-semibold text-[#4C0519]">Teilnehmer</h3>
            <p className="text-sm text-gray-600">Treten Sie Tastings bei und vergleichen Sie Ihre Ergebnisse</p>
          </div>
          <div className="bg-[#4C0519]/5 p-4 rounded-lg">
            <h3 className="font-semibold text-[#4C0519]">Flüge</h3>
            <p className="text-sm text-gray-600">Organisieren Sie Weine in zeitlich begrenzten Runden</p>
          </div>
          <div className="bg-[#4C0519]/5 p-4 rounded-lg">
            <h3 className="font-semibold text-[#4C0519]">Punktesystem</h3>
            <p className="text-sm text-gray-600">Benutzerdefinierte Bewertungsregeln für verschiedene Weinattribute</p>
          </div>
        </div>
      </div>
    </div>
  );
}