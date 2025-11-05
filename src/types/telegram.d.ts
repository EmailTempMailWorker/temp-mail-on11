export interface TelegramMessage {
	message_id: number;
	from: {
		id: number;
		is_bot: boolean;
		first_name: string;
		username?: string;
	};
	chat: {
		id: number;
		type: string;
	};
	date: number;
	text?: string;
}

export interface TelegramUpdate {
	update_id: number;
	message?: TelegramMessage;
}
