import React from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { ErrorBoundary } from "./ErrorBoundary";
import { Outlet } from "react-router-dom";

const Main = () => {
	return (
		<div className="flex min-h-screen bg-gray-50">
			<Sidebar />
			<div className="flex flex-col ml-[240px] flex-1 xl:flex-row">
				<main className="flex-1">
					<Header />
					<ErrorBoundary>
						<Outlet />
					</ErrorBoundary>
				</main>
			</div>
		</div>
	);
};

export default Main;
