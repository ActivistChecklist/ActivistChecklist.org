module.exports = {
    darkMode: ["class"],
    content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
  	extend: {
  		// fontSize: {
  		// 	'3xl': ['3rem', {
  		// 		lineHeight: '2.5rem',
  		// 		letterSpacing: '-0.02em',
  		// 		fontWeight: '700'
  		// 	}]
  		// },
  		scale: {
  			'101': '1.01',
  			'102': '1.02',
  			'103': '1.03'
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			mark: {
  				DEFAULT: 'hsl(var(--mark-background))',
  				foreground: 'hsl(var(--mark-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))',
  				text: 'hsl(var(--destructive))',
  				border: 'hsl(var(--destructive) / 0.2)'
  			},
  			warning: {
  				DEFAULT: 'hsl(var(--warning))',
  				foreground: 'hsl(var(--warning-foreground))',
  				text: 'hsl(var(--warning))',
  				border: 'hsl(var(--warning) / 0.2)'
  			},
  			info: {
  				DEFAULT: 'hsl(var(--info))',
  				foreground: 'hsl(var(--info-foreground))',
  				text: 'hsl(var(--info))',
  				border: 'hsl(var(--info) / 0.2)'
  			},
  			success: {
  				DEFAULT: 'hsl(var(--success))',
  				foreground: 'hsl(var(--success-foreground))',
  				text: 'hsl(var(--success))',
  				border: 'hsl(var(--success) / 0.2)'
  			}
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			},
  			'spin': {
  				to: {
  					transform: 'rotate(360deg)'
  				}
  			},
  			'rainbow-shift': {
  				'0%, 100%': {
  					color: '#f472b6', // pink-400
  				},
  				'16.67%': {
  					color: '#c084fc', // purple-400
  				},
  				'33.33%': {
  					color: '#60a5fa', // blue-400
  				},
  				'50%': {
  					color: '#4ade80', // green-400
  				},
  				'66.67%': {
  					color: '#facc15', // yellow-400
  				},
  				'83.33%': {
  					color: '#fb923c', // orange-400
  				},
  			},
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'spin': 'spin 0.6s linear infinite',
  			'rainbow-shift': 'rainbow-shift 3s linear infinite',
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")]
}

