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
      <div className="flex items-center justify-center min-h-screen bg-vinaturel-light">
        <div className="animate-spin w-10 h-10 border-4 border-vinaturel-original border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 flex flex-col md:flex-row gap-8 min-h-screen items-center bg-vinaturel-light">
      {/* Form Section */}
      <div className="md:w-1/2 w-full max-w-md mx-auto flex flex-col items-center">
        {/* Bild oben */}
        <img
          src="/BlindSip_glass_only_cleaned.png"
          alt="BlindSip Glas"
          className="w-20 h-20 object-contain mb-4"
          style={{ filter: 'drop-shadow(0 1px 10px rgba(0,0,0,0.07))' }}
        />
        <Card className="border border-vinaturel-highlight shadow-lg bg-white">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <Wine className="h-6 w-6 text-vinaturel-original" />
              <CardTitle className="text-2xl font-bold text-vinaturel-original">BlindSip</CardTitle>
            </div>
            <CardDescription>
              Melden Sie sich an, um an Weintastings teilzunehmen oder Ihre eigenen zu erstellen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" value={activeTab} onValueChange={(value) => setActiveTab(value as 'login' | 'register')}>
              <TabsList className="grid w-full grid-cols-2 mb-6 bg-vinaturel-light border border-vinaturel-highlight rounded-lg">
                <TabsTrigger value="login" className="data-[state=active]:bg-vinaturel-original data-[state=active]:text-white">
                  Anmelden
                </TabsTrigger>
                <TabsTrigger value="register" className="data-[state=active]:bg-vinaturel-original data-[state=active]:text-white">
                  Registrieren
                </TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                    <FormField
                      control={loginForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-vinaturel-original">E-Mail</FormLabel>
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
                          <FormLabel className="text-vinaturel-original">Passwort</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      className="w-full bg-vinaturel-original hover:bg-vinaturel-highlight text-white font-semibold"
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
                          <FormLabel className="text-vinaturel-original">Name</FormLabel>
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
                          <FormLabel className="text-vinaturel-original">E-Mail</FormLabel>
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
                          <FormLabel className="text-vinaturel-original">Unternehmen</FormLabel>
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
                          <FormLabel className="text-vinaturel-original">Profilbild</FormLabel>
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
                                <div className="relative w-20 h-20 mt-2 rounded-full overflow-hidden border border-vinaturel-highlight">
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
                          <FormLabel className="text-vinaturel-original">Passwort</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      className="w-full bg-vinaturel-original hover:bg-vinaturel-highlight text-white font-semibold"
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
              <span
                onClick={() => setActiveTab(activeTab === 'login' ? 'register' : 'login')}
                className="cursor-pointer text-vinaturel-original hover:underline"
              >
                {activeTab === 'login' ? 'Noch kein Konto? Jetzt registrieren' : 'Bereits registriert? Anmelden'}
              </span>
            </div>
          </CardFooter>
        </Card>
      </div>
      {/* Hero Section */}
      <div className="md:w-1/2 flex flex-col items-center md:items-start gap-6 text-center md:text-left">
        <h1 className="text-4xl font-bold !leading-tight">
          <span className="bg-gradient-to-r from-vinaturel-original to-vinaturel-highlight bg-clip-text text-transparent">
            Blindverkostung. Aber mit Stil.
          </span>
        </h1>
        <p className="text-lg text-gray-700 max-w-md">
          Wein trinken, Punkte sammeln, Wissen testen – und das alles ohne Etiketten. <br />
          <span className="text-vinaturel-highlight font-semibold">Vinaturel</span> bringt Ihre Blindproben auf das nächste Level.<br />
          <span className="text-vinaturel-original">Probieren Sie es aus – Ihr Weinwissen wird es Ihnen danken.</span>
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 w-full max-w-md">
          <div className="bg-vinaturel-light border border-vinaturel-highlight p-4 rounded-lg">
            <h3 className="font-semibold text-vinaturel-original">Gastgeber</h3>
            <p className="text-sm text-gray-700">Erstellen Sie Tastings, laden Sie Freunde ein oder machen Sie es öffentlich. Der Gastgeber hat immer das letzte Wort – außer beim Wein.</p>
          </div>
          <div className="bg-vinaturel-light border border-vinaturel-highlight p-4 rounded-lg">
            <h3 className="font-semibold text-vinaturel-original">Teilnehmer</h3>
            <p className="text-sm text-gray-700">Treten Sie Tastings bei, geben Sie Ihre Tipps ab und vergleichen Sie Ihre Ergebnisse mit anderen. Wer hat die beste Nase?</p>
          </div>
          <div className="bg-vinaturel-light border border-vinaturel-highlight p-4 rounded-lg">
            <h3 className="font-semibold text-vinaturel-original">Flights</h3>
            <p className="text-sm text-gray-700">Weine werden in Runden serviert. Keine Panik – für Wasser ist auch gesorgt.</p>
          </div>
          <div className="bg-vinaturel-light border border-vinaturel-highlight p-4 rounded-lg">
            <h3 className="font-semibold text-vinaturel-original">Punktesystem</h3>
            <p className="text-sm text-gray-700">Flexible Bewertung: Herkunft, Rebsorte, Jahrgang und mehr. Wer punktet, gewinnt – und lernt dazu.</p>
          </div>
        </div>
      </div>
    </div>
  );
}