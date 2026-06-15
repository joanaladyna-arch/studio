"use client";

import { useState } from "react";
import { Navigation } from "@/components/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Search, Filter } from "lucide-react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { id: "all", label: "Tous" },
  { id: "pal", label: "PAL" },
  { id: "progress", label: "En cours" },
  { id: "read", label: "Lus" },
  { id: "dnf", label: "DNF" },
];

export default function LibraryPage() {
  const [activeTab, setActiveTab] = useState("all");

  const books = [
    { title: "L'élégance du hérisson", author: "Muriel Barbery", status: "progress", cover: "https://picsum.photos/seed/10/200/300" },
    { title: "La vérité sur l'affaire Harry Quebert", author: "Joël Dicker", status: "read", cover: "https://picsum.photos/seed/11/200/300" },
    { title: "Sapiens", author: "Yuval Noah Harari", status: "pal", cover: "https://picsum.photos/seed/12/200/300" },
    { title: "Moby Dick", author: "Herman Melville", status: "dnf", cover: "https://picsum.photos/seed/13/200/300" },
    { title: "Les Fleurs du Mal", author: "Charles Baudelaire", status: "read", cover: "https://picsum.photos/seed/14/200/300" },
  ];

  const filteredBooks = activeTab === "all" ? books : books.filter(b => b.status === activeTab);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <Navigation />

      <header className="space-y-4">
        <h1 className="text-4xl font-headline">Ma Bibliothèque</h1>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher dans ma collection..." className="pl-9 bg-muted/50 border-none focus-visible:ring-primary" />
          </div>
          <button className="p-2 border rounded-lg hover:bg-muted"><Filter className="h-5 w-5" /></button>
        </div>
      </header>

      <Tabs defaultValue="all" className="w-full" onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start overflow-x-auto h-auto bg-transparent border-b p-0 rounded-none gap-6">
          {CATEGORIES.map((cat) => (
            <TabsTrigger 
              key={cat.id} 
              value={cat.id}
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-2 font-medium"
            >
              {cat.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
            {filteredBooks.map((book, i) => (
              <div key={i} className="space-y-2 group">
                <div className="relative aspect-[2/3] rounded-xl overflow-hidden shadow-sm group-hover:shadow-xl transition-all duration-500">
                  <Image src={book.cover} alt={book.title} fill className="object-cover" />
                  <div className="absolute top-2 right-2">
                    <StatusBadge status={book.status} />
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold line-clamp-1">{book.title}</h3>
                  <p className="text-xs text-muted-foreground">{book.author}</p>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { label: string, className: string }> = {
    pal: { label: "PAL", className: "bg-muted text-muted-foreground" },
    progress: { label: "Lecture", className: "bg-chart-3/20 text-chart-3" },
    read: { label: "Lu", className: "bg-chart-2/20 text-chart-2" },
    dnf: { label: "DNF", className: "bg-destructive/10 text-destructive" }
  };
  const config = configs[status];
  return (
    <Badge className={cn("text-[10px] font-bold border-none", config.className)}>
      {config.label}
    </Badge>
  );
}
