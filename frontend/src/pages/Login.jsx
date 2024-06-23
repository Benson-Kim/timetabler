import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { MdLogin, MdOutlineHttps } from "react-icons/md";

const Login = () => {
	const navigate = useNavigate();
	const [user, setUser] = useState(false);

	const {
		handleSubmit,
		formState: { errors },
		register,
	} = useForm();

	const handleLoginSubmit = () => {
		setUser(true);
	};

	useEffect(() => {
		if (user) {
			navigate("/app");
		}
	}, [user]);
	return (
		<div className="flex min-h-screen justify-center items-center">
			{/* Login Card */}
			<div className="bg-light-gray w-[400px] p-5 pt-2 rounded-box ">
				<div className="bg-dark-orange text-white rounded-box p-3 flex items-center justify-center mt-5 gap-5">
					<MdOutlineHttps />

					<h4 className="text-center font-bold capitalize">Welcome Back</h4>
				</div>
				<hr className="opacity-30 my-5" />
				<form
					onSubmit={handleSubmit(handleLoginSubmit)}
					action=""
					className="flex flex-col mt-6">
					<div className="my-3">
						<input
							type="username"
							id="username"
							label="username Address"
							className="w-full py-2 px-4 text-primary-black/80 border border-dark-green/50 focus:border-dark-green focus:outline-none focus:ring-0 bg-light-gray rounded-btn"
							error={!!errors.username}
							{...register("username", {
								required: {
									value: true,
									message: "username is required",
								},
							})}
							placeholder="Enter your username"
						/>
					</div>
					<div className="my-3">
						<input
							id="password"
							type="password"
							label="Password"
							error={!!errors.password}
							className="w-full py-2 px-4 text-primary-black/80 border border-dark-green/50 focus:border-dark-green focus:outline-none focus:ring-0 bg-light-gray rounded-btn"
							{...register("password", {
								required: {
									value: true,
									message: "Password is required",
								},
							})}
							placeholder="Enter your password"
						/>
					</div>
					<div className="mt-8 flex justify-between items-center flex-1 w-full">
						<Link
							className="text-sm font-semibold hover:text-light-gray w-2/3"
							to="/forgot-password">
							Forgot your password?
						</Link>
						<button
							type="submit"
							class="bg-dark-orange hover:bg-dark-orange/95 font-semibold text-light-gray py-2 px-4 rounded inline-flex gap-2.5 items-center">
							<MdLogin />
							<span>Continue</span>
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};

export default Login;
