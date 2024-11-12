window["env"] = {
	production: true,
	name: 'prod environment',
	staging: false,
	dev: false,
	baseUrl: 'http://localhost:3569',
	restictedPages: [],
	unauthorizedRedirectUrl:"/auth/login",
	supportEmail: 'example@org.com',
	password: {
		minLength: 10,
		rejectPattern: '^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#%$&()\\-`.+,/]).{10,}$',
		errorMessage: 'Password should contain at least one uppercase letter, one number and one special character.',
	},
  };