# Options Tracker

A modern web application for tracking options trading positions and performance. Built with Next.js, TypeScript, and Tailwind CSS.

## Features

- **Dashboard Overview**: View key metrics including total P&L, open positions, portfolio value, and win rate
- **Position Management**: Add new options positions with detailed information
- **Performance Tracking**: Monitor individual position performance and overall portfolio
- **Visual Analytics**: P&L chart showing performance over time
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Custom components with Radix UI primitives
- **Icons**: Lucide React
- **Database**: Supabase (configured for future use)

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd options-tracker
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Adding New Positions

1. Click the "New Position" button in the header
2. Fill out the form with:
   - Stock symbol (e.g., AAPL, TSLA)
   - Option type (Call or Put)
   - Strike price
   - Expiration date
   - Quantity
   - Entry price
   - Optional notes
3. Click "Add Position" to save

### Viewing Performance

- **Summary Cards**: Quick overview of key metrics
- **P&L Chart**: Visual representation of performance over time
- **Positions Table**: Detailed view of all open positions

## Project Structure

```
src/
├── app/                 # Next.js app directory
│   ├── page.tsx        # Main dashboard page
│   ├── layout.tsx      # Root layout
│   └── globals.css     # Global styles
├── components/          # React components
│   ├── ui/             # Reusable UI components
│   └── PnLChart.tsx    # Performance chart component
└── lib/                # Utility functions
```

## Future Enhancements

- [ ] Real-time market data integration
- [ ] Position editing and closing
- [ ] Advanced analytics and reporting
- [ ] Portfolio diversification metrics
- [ ] Risk management tools
- [ ] Export functionality
- [ ] User authentication
- [ ] Multi-portfolio support

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License.

## Disclaimer

This application is for educational and personal use only. It is not financial advice and should not be used as the sole basis for investment decisions. Always consult with a qualified financial advisor before making investment decisions.
