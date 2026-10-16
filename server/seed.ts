// Adds a couple of sample sets so there is something to study. Run with `npm run seed`.
import { createFolder, addSetToFolder, createSet } from './repo';

const spanish = createSet({
  title: 'Spanish Basics',
  description: 'Everyday Spanish vocabulary for beginners.',
  cards: [
    ['hola', 'hello'],
    ['adiós', 'goodbye'],
    ['por favor', 'please'],
    ['gracias', 'thank you'],
    ['el perro', 'the dog'],
    ['el gato', 'the cat'],
    ['la casa', 'the house'],
    ['el agua', 'the water'],
    ['la manzana', 'the apple'],
    ['el libro', 'the book'],
    ['rojo', 'red'],
    ['azul', 'blue'],
    ['grande', 'big'],
    ['pequeño', 'small'],
    ['feliz', 'happy'],
  ].map(([term, definition]) => ({ term, definition })),
});

const capitals = createSet({
  title: 'World Capitals',
  description: 'Countries and their capital cities.',
  cards: [
    ['France', 'Paris'],
    ['Japan', 'Tokyo'],
    ['Brazil', 'Brasília'],
    ['Canada', 'Ottawa'],
    ['Australia', 'Canberra'],
    ['Egypt', 'Cairo'],
    ['Kenya', 'Nairobi'],
    ['Nigeria', 'Abuja'],
    ['Germany', 'Berlin'],
    ['India', 'New Delhi'],
    ['Argentina', 'Buenos Aires'],
    ['South Korea', 'Seoul'],
  ].map(([term, definition]) => ({ term, definition })),
});

const folder = createFolder({ name: 'Languages & Geography', description: 'Sample folder' });
addSetToFolder(folder.id, spanish.id);
addSetToFolder(folder.id, capitals.id);

console.log(`Seeded "${spanish.title}", "${capitals.title}" and folder "${folder.name}".`);
