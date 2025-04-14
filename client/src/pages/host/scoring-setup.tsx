import { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Tasting, ScoringRule } from "@shared/schema";
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
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const scoringSchema = z.object({
  country: z.preprocess(
    (val) => (val === "" ? 0 : Number(val)),
    z.number().min(0).max(5)
  ),
  region: z.preprocess(
    (val) => (val === "" ? 0 : Number(val)),
    z.number().min(0).max(5)
  ),
  producer: z.preprocess(
    (val) => (val === "" ? 0 : Number(val)),
    z.number().min(0).max(5)
  ),
  wineName: z.preprocess(
    (val) => (val === "" ? 0 : Number(val)),
    z.number().min(0).max(5)
  ),
  vintage: z.preprocess(
    (val) => (val === "" ? 0 : Number(val)),
    z.number().min(0).max(5)
  ),
  varietals: z.preprocess(
    (val) => (val === "" ? 0 : Number(val)),
    z.number().min(0).max(5)
  ),
  anyVarietalPoint: z.boolean().default(false),
  displayCount: z.preprocess(
    (val) => (val === "" ? null : Number(val)),
    z.number().min(1).nullable()
  ),
});

type ScoringFormData = z.infer<typeof scoringSchema>;

export default function ScoringSetup() {
  const { id } = useParams<{ id: string }>();
  const tastingId = parseInt(id);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: tasting, isLoading: tastingLoading } = useQuery<Tasting>({
    queryKey: [`/api/tastings/${tastingId}`],
  });

  const form = useForm<ScoringFormData>({
    resolver: zodResolver(scoringSchema),
    defaultValues: {
      country: 1,
      region: 1,
      producer: 1,
      wineName: 1,
      vintage: 1,
      varietals: 1,
      anyVarietalPoint: false,
      displayCount: null,
    },
  });

  const createScoringMutation = useMutation({
    mutationFn: async (data: ScoringFormData) => {
      const res = await apiRequest("POST", `/api/tastings/${tastingId}/scoring`, {
        ...data,
        tastingId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tastings/${tastingId}/scoring`] });
      toast({
        title: "Scoring rules saved",
        description: "Your scoring system has been set up successfully.",
      });
      navigate(`/host/wines/${tastingId}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save scoring rules",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ScoringFormData) => {
    createScoringMutation.mutate(data);
  };

  if (tastingLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-[#4C0519]" />
      </div>
    );
  }

  if (!tasting) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600">Tasting not found</h2>
          <p className="mt-2">This tasting does not exist or you don't have access to it.</p>
          <Button className="mt-4" onClick={() => navigate("/")}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <Card className="border-none shadow-lg">
          <CardHeader className="border-b bg-gray-50 rounded-t-lg">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-2xl font-display text-[#4C0519]">Setup Scoring System</CardTitle>
                <CardDescription>Define how points will be awarded for correct guesses</CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-gray-300 text-gray-600 flex items-center justify-center">1</div>
                <div className="w-8 h-8 rounded-full bg-[#4C0519] text-white flex items-center justify-center">2</div>
                <span className="text-xs text-gray-500 hidden sm:inline">Scoring</span>
              </div>
            </div>
          </CardHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardContent className="py-6 space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-2">Points for correct guesses</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Set how many points (0-5) participants will receive for each correct identification
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="country"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Country</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              max={5}
                              placeholder="0-5 points"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="region"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Region</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              max={5}
                              placeholder="0-5 points"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="producer"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Producer/Winery</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              max={5}
                              placeholder="0-5 points"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="wineName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Wine Name</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              max={5}
                              placeholder="0-5 points"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="vintage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vintage</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              max={5}
                              placeholder="0-5 points"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="varietals"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Grape Varietals</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              max={5}
                              placeholder="0-5 points"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="mt-6">
                    <FormField
                      control={form.control}
                      name="anyVarietalPoint"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Varietal Scoring Rule</FormLabel>
                            <FormDescription>
                              Award points if any varietal is correct? If disabled, all varietals must match exactly.
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-lg font-medium mb-2">Leaderboard Settings</h3>
                  <FormField
                    control={form.control}
                    name="displayCount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Top Positions to Display</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            placeholder="Leave empty to show all participants"
                            value={field.value === null ? "" : field.value}
                            onChange={(e) => {
                              const value = e.target.value === "" ? null : parseInt(e.target.value);
                              field.onChange(value);
                            }}
                          />
                        </FormControl>
                        <FormDescription>
                          Limit how many participants to show on the leaderboard. Leave empty to show all.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>

              <CardFooter className="bg-gray-50 rounded-b-lg border-t flex justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(`/host/create`)}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  className="bg-[#4C0519] hover:bg-[#3A0413]"
                  disabled={createScoringMutation.isPending}
                >
                  {createScoringMutation.isPending ? "Saving..." : "Next: Add Wines"}
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
      </div>
    </div>
  );
}
