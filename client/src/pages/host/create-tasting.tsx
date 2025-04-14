import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Tasting } from "@shared/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Globe, Lock, Users } from "lucide-react";

const createTastingSchema = z.object({
  name: z.string().min(3, "Tasting name must be at least 3 characters"),
  tastingType: z.enum(["public", "password", "private"]),
  password: z.string().optional(),
  invitees: z.string().optional(),
});

type CreateTastingFormData = z.infer<typeof createTastingSchema>;

export default function CreateTasting() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [selectedType, setSelectedType] = useState<string>("public");

  const form = useForm<CreateTastingFormData>({
    resolver: zodResolver(createTastingSchema),
    defaultValues: {
      name: "",
      tastingType: "public",
      password: "",
      invitees: "",
    },
  });

  const createTastingMutation = useMutation({
    mutationFn: async (data: CreateTastingFormData) => {
      const requestData: any = {
        name: data.name,
        hostId: user?.id,
        isPublic: data.tastingType === "public" || data.tastingType === "password",
      };

      if (data.tastingType === "password" && data.password) {
        requestData.password = data.password;
      }

      if (data.tastingType === "private" && data.invitees) {
        requestData.invitees = data.invitees.split(",").map(email => email.trim());
      }

      const res = await apiRequest("POST", "/api/tastings", requestData);
      return res.json();
    },
    onSuccess: (tasting: Tasting) => {
      navigate(`/host/scoring/${tasting.id}`);
    },
  });

  const onSubmit = (data: CreateTastingFormData) => {
    createTastingMutation.mutate(data);
  };

  const handleTypeChange = (value: string) => {
    setSelectedType(value);
    form.setValue("tastingType", value as "public" | "password" | "private");
  };

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <Card className="border-none shadow-lg">
          <CardHeader className="border-b bg-gray-50 rounded-t-lg">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-2xl font-display text-[#4C0519]">Create a New Tasting</CardTitle>
                <CardDescription>Set up the basic details for your wine tasting</CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-[#4C0519] text-white flex items-center justify-center">1</div>
                <span className="text-xs text-gray-500 hidden sm:inline">Settings</span>
              </div>
            </div>
          </CardHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardContent className="py-6 space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tasting Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g. Summer Reds Blind Tasting" 
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        Choose a descriptive name that will help participants identify your tasting.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-3">
                  <FormLabel>Tasting Type</FormLabel>
                  <RadioGroup
                    value={selectedType}
                    onValueChange={handleTypeChange}
                    className="space-y-3"
                  >
                    <div className={`relative bg-white rounded-lg border ${selectedType === "public" ? "border-[#4C0519]" : "border-gray-300"} hover:border-[#4C0519] cursor-pointer p-4`}>
                      <div className="flex items-start">
                        <div className="flex items-center h-5">
                          <RadioGroupItem value="public" id="tasting-type-public" />
                        </div>
                        <div className="ml-3">
                          <Label htmlFor="tasting-type-public" className="font-medium text-gray-800">Public Tasting</Label>
                          <p className="text-gray-500 text-sm">Anyone can see and join your tasting</p>
                        </div>
                        <div className="ml-auto">
                          <Globe className="h-5 w-5 text-gray-400" />
                        </div>
                      </div>
                    </div>

                    <div className={`relative bg-white rounded-lg border ${selectedType === "password" ? "border-[#4C0519]" : "border-gray-300"} hover:border-[#4C0519] cursor-pointer p-4`}>
                      <div className="flex items-start">
                        <div className="flex items-center h-5">
                          <RadioGroupItem value="password" id="tasting-type-password" />
                        </div>
                        <div className="ml-3">
                          <Label htmlFor="tasting-type-password" className="font-medium text-gray-800">Password Protected</Label>
                          <p className="text-gray-500 text-sm">Participants need a password to join</p>
                        </div>
                        <div className="ml-auto">
                          <Lock className="h-5 w-5 text-gray-400" />
                        </div>
                      </div>
                      {selectedType === "password" && (
                        <div className="mt-3 ml-7">
                          <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Password</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="password" 
                                    placeholder="Enter a password" 
                                    {...field} 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      )}
                    </div>

                    <div className={`relative bg-white rounded-lg border ${selectedType === "private" ? "border-[#4C0519]" : "border-gray-300"} hover:border-[#4C0519] cursor-pointer p-4`}>
                      <div className="flex items-start">
                        <div className="flex items-center h-5">
                          <RadioGroupItem value="private" id="tasting-type-private" />
                        </div>
                        <div className="ml-3">
                          <Label htmlFor="tasting-type-private" className="font-medium text-gray-800">Private (Invite Only)</Label>
                          <p className="text-gray-500 text-sm">Only invited participants can join</p>
                        </div>
                        <div className="ml-auto">
                          <Users className="h-5 w-5 text-gray-400" />
                        </div>
                      </div>
                      {selectedType === "private" && (
                        <div className="mt-3 ml-7">
                          <FormField
                            control={form.control}
                            name="invitees"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Invite Participants (Email addresses, comma separated)</FormLabel>
                                <FormControl>
                                  <Textarea 
                                    placeholder="email@example.com, another@example.com" 
                                    rows={3}
                                    {...field} 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      )}
                    </div>
                  </RadioGroup>
                </div>
              </CardContent>

              <CardFooter className="bg-gray-50 rounded-b-lg border-t flex justify-between">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => navigate("/")}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  className="bg-[#4C0519] hover:bg-[#3A0413]"
                  disabled={createTastingMutation.isPending}
                >
                  {createTastingMutation.isPending ? "Creating..." : "Next: Scoring System"}
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
      </div>
    </div>
  );
}
