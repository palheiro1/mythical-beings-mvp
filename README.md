# 🔮 Mythical Beings: A Strategic Card Game of Wisdom and Elemental Power 🔮

## 🌊 🌲 💨 Welcome to the Realm of Mythical Beings! 🌊 🌲 💨

![Game Banner](public/images/kukul.png)

> *"In the ancient chronicles, mythical creatures from across the world gather to contest their wisdom and elemental powers. Only those who master both strategy and mystical knowledge shall prevail!"*

## 🎮 Game Overview

**Mythical Beings** is a strategic card game where players harness the powers of legendary creatures from global folklore. Each player controls three mythical beings, each with unique passive abilities tied to elemental forces - Water, Earth, and Air.

Players take turns drawing Knowledge cards from the Market, summoning them onto their creatures, and rotating their creatures to gain wisdom. The ultimate goal is to outlast your opponent by preserving your power points while depleting theirs.

## ✨ Key Features

- **Mythical Creatures**: 15 diverse mythical beings from world folklore, each with unique passive abilities
- **Elemental Knowledge**: Knowledge cards across three elements (Water, Earth, Air) with varying wisdom costs
- **Strategic Gameplay**: Balance creature rotation, knowledge acquisition, and tactical card placement
- **Real-time Multiplayer**: Challenge other players in live matches
- **Profile Customization**: Personalize your avatar and username
- **Game Logs**: Track all game actions with our detailed logging system

## 🎲 How to Play

1. **Select Your Team**: Choose 3 mythical beings to form your team
2. **Gain Knowledge**: Draw Knowledge cards from the Market during the Knowledge Phase
3. **Rotate & Summon**: Rotate your creatures to gain wisdom, then use that wisdom to summon Knowledge cards
4. **Trigger Abilities**: Utilize your creatures' passive abilities to gain advantages
5. **Victory**: Reduce your opponent's power to zero or have more power when the knowledge deck is depleted

## 🚀 Getting Started

### Prerequisites

- Node.js (v16+)
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/YourUsername/CardGame.git

# Navigate to the project directory
cd CardGame/mythical-beings-mvp

# Install dependencies
npm install

# Start the development server
npm run dev
```

### Environment Setup

Create a `.env` file in the root directory with the following:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 🧙‍♂️ Game Elements

### Creatures

Each mythical being has:
- An elemental affinity (Water, Earth, Air)
- A unique passive ability
- A wisdom cycle that changes with rotation

### Knowledge Cards

Knowledge cards represent magical skills and wisdom:
- **Types**: Spells, Allies
- **Elements**: Water (Aquatic), Earth (Terrestrial), Air (Aerial)
- **Costs**: Varying wisdom costs (1-5)
- **Effects**: Various gameplay effects like damage, healing, or special abilities

## 🛠️ Technical Implementation

- **Frontend**: React with TypeScript, styled with Tailwind CSS
- **State Management**: React hooks and context API
- **Realtime**: Supabase for authentication and realtime game state synchronization
- **Testing**: Comprehensive Jest test suite

## 📚 Project Structure

- `/src/components`: UI components including Card, CreatureZone, and Market
- `/src/game`: Core game logic including state, rules, and actions
- `/src/pages`: Main application pages for different game screens
- `/src/context`: Authentication and global state contexts
- `/src/hooks`: Custom React hooks for game functionality
- `/src/utils`: Utility functions for Supabase integration

## 🎯 Future Enhancements

- Mobile responsiveness improvements
- Additional mythical beings from more cultural traditions
- Tournament mode with leaderboards
- Deck builder for custom creature selections
- Enhanced visual effects and animations

## 💻 Development Commands

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Reset a test game (for development)
node reset-game.js
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📜 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgements

- All the amazing folklore and mythologies that inspired our creatures
- The incredible team of developers and artists who brought this game to life
- Our dedicated players and testers who provided valuable feedback

---

<p align="center">
  <em>May the wisest being win! 🏆</em>
</p>
