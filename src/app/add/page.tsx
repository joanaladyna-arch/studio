
"use client";

import { useState } from "react";
import { Navigation } from "@/components/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Barcode, BookPlus } from "lucide-react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore } from "@/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function AddBookPage() {
  const { user } = useUser();
  const db = useFirestore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const { toast } = useToast();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate API search
    setResults([
      { id: "1", title: "Le Petit Prince", author: "Antoine de Saint-Exupéry", cover: "https://picsum.photos/seed/pp/200/300" },
      { id: "2", title: "L'Alchimiste", author: "Paulo Coelho", cover: "https://picsum.photos/seed/alc/200/300" },
      { id: "3", title: "1984", author: "George Orwell", cover: "https://picsum.photos/seed/1984/200/300" },
    ]);
  };

  const addBook = (book: any) => {
    if (!db || !user) {
      toast({ variant: "destructive", title: "Erreur", description: "Vous devez être connecté pour ajouter un livre." });
      return;
    }

    const bookData = {
      title: book.title,
      author: book.author,
      cover: book.cover,
      status: "pal",
      favorite: false,
      createdAt: serverTimestamp()
    };

    const booksRef = collection(db, "users", user.uid, "books");

    addDoc(booksRef, bookData)
      .then(() => {
        toast({
          title: "Livre ajouté !",
          description: `${book.title} a été ajouté à votre bibliothèque (PAL).`,
        });
      })
      .catch(async (e) => {
        const permissionError = new FirestorePermissionError({
          path: booksRef.path,
          operation: 'create',
          requestResourceData: bookData,
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <Navigation />

      <header>
        <h1 className="text-4xl font-headline">Ajouter un livre</h1>
        <p className="text-muted-foreground">Scannez un ISBN ou recherchez par titre.</p>
      </header>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Titre, auteur ou ISBN..." 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 h-12"
          />
        </div>
        <Button size="icon" variant="outline" className="h-12 w-12">
          <Barcode className="h-6 w-6" />
        </Button>
        <Button type="submit" className="h-12 px-6">Rechercher</Button>
      </form>

      <div className="space-y-4">
        {results.length > 0 ? (
          results.map((book) => (
            <Card key={book.id} className="glass-card hover:bg-white/80 transition-colors">
              <CardContent className="p-4 flex gap-4 items-center">
                <div className="relative h-24 w-16 shrink-0 rounded overflow-hidden shadow-sm">
                  <Image src={book.cover} alt={book.title} fill className="object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg line-clamp-1">{book.title}</h3>
                  <p className="text-sm text-muted-foreground">{book.author}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => addBook(book)} className="text-primary hover:text-primary hover:bg-primary/10">
                  <Plus className="h-6 w-6" />
                </Button>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="py-20 flex flex-col items-center justify-center text-muted-foreground gap-4">
            <BookPlus className="h-16 w-16 opacity-20" />
            <p>Commencez par rechercher un livre.</p>
          </div>
        )}
      </div>
    </div>
  );
}
