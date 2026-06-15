"use client";

import { useState, useMemo } from "react";
import { Navigation } from "@/components/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Search, Filter, Heart } from "lucide-react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { id: "all", label: "Tous" },
  { id: "pal", label: "PAL" },
  { id: "progress", label: "En cours" },
  { id: "read", label: "Lu" },
  { id: "dnf", label: "DNF (Livre non terminé ou pas aimé)" },
  { id: "favorite", label: "Favoris" },
];

interface Book {
  title: string;
  author: string;
  status: "pal" | "progress" | "read" | "dnf";
  favorite: boolean;
  cover: string;
}

export default function LibraryPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const books: Book[] = useMemo(() => [
    { title: "L'élégance du hérisson", author: "Muriel Barbery", status: "progress", favorite: true, cover: "https://picsum.photos/seed/10/200/300" },
    { title: "La vérité sur l'affaire Harry Quebert", author: "Joël Dicker", status: "read", favorite: true, cover: "https://picsum.photos/seed/11/200/300" },
    { title: "Sapiens", author: "Yuval Noah Harari", status: "pal", favorite: false, cover: "https://picsum.photos/seed/12/200/300" },
    { title: "Moby Dick", author: "Herman Melville", status: "dnf", favorite: false, cover: "https://picsum.photos/seed/13/200/300" },
    { title: "Les Fleurs du Mal", author: "Charles Baudelaire", status: "read", favorite: true, cover: "https://picsum.photos/seed/14/200/300" },
    { title: "Petit Pays", author: "Gaël Faye", status: "pal", favorite: false, cover: "https://picsum.photos/seed/15/200/300" },
  ], []);

  const counts = useMemo(() => ({
    all: books.length,
    pal: books.filter(b => b.status === 'pal').length,
    progress: books.filter(b => b.status === 'progress').length,
    read: books.filter(b => b.status === 'read').length,
    dnf: books.filter(b => b.status === 'dnf').length,
    favorite: books.filter(b => b.favorite).length,
  }), [books]);

  const filteredBooks = useMemo(() => {
    return books.filter(book => {
      const matchesSearch = book.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           book.author.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (!matchesSearch) return false;
      if (activeTab === "all") return true;
      if (activeTab === "favorite") return book.favorite;
      return book.status === activeTab;
    });
  }, [books, activeTab, searchQuery]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <Navigation />

      <header className="space-y-4">
        <h1 className="text-4xl font-headline">Ma Bibliothèque</h1>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Rechercher un titre ou un auteur..." 
              className="pl-9 bg-muted/50 border-none focus-visible:ring-primary"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="p-2 border rounded-lg hover:bg-muted transition-colors">
            <Filter className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      </header>

      <Tabs defaultValue="all" className="w-full" onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start overflow-x-auto h-auto bg-transparent border-b p-0 rounded-none gap-4 no-scrollbar">
          {CATEGORIES.map((cat) => (
            <TabsTrigger 
              key={cat.id} 
              value={cat.id}
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-2 font-medium px-2 flex items-center gap-2 whitespace-nowrap"
            >
              {cat.label}
              <Badge variant="secondary" className="h-5 px-1.5 min-w-[1.25rem] flex items-center justify-center text-[10px] bg-muted group-data-[state=active]:bg-primary group-data-[state=active]:text-primary-foreground">
                {counts[cat.id as keyof typeof counts] || 0}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {filteredBooks.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
              {filteredBooks.map((book, i) => (
                <div key={i} className="space-y-2 group">
                  <div className="relative aspect-[2/3] rounded-xl overflow-hidden shadow-sm group-hover:shadow-xl transition-all duration-500">
                    <Image src={book.cover} alt={book.title} fill className="object-cover" />
                    <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                      <StatusBadge status={book.status} />
                      {book.favorite && (
                        <div className="bg-white/90 p-1 rounded-full shadow-sm">
                          <Heart className="h-3 w-3 text-red-500 fill-red-500" />
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold line-clamp-1">{book.title}</h3>
                    <p className="text-xs text-muted-foreground">{book.author}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-20 text-center space-y-2">
              <p className="text-muted-foreground">Aucun livre trouvé dans cette catégorie.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { label: string, className: string }> = {
    pal: { label: "PAL", className: "bg-slate-500/90 text-white" },
    progress: { label: "Lecture", className: "bg-blue-500/90 text-white" },
    read: { label: "Lu", className: "bg-emerald-500/90 text-white" },
    dnf: { label: "DNF (Livre non terminé ou pas aimé)", className: "bg-rose-500/90 text-white" }
  };
  const config = configs[status];
  return (
    <Badge className={cn("text-[9px] font-bold border-none px-1.5 py-0 text-center", config.className)}>
      {config.label}
    </Badge>
  );
}
